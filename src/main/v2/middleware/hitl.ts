import { EventEmitter } from "node:events";
import type { Middleware, MiddlewareContext } from "./types";

/**
 * Risk level for operations
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * HITL approval request
 */
export type HITLApprovalRequest = {
  taskId: string;
  operation: string;
  risk: RiskLevel;
  details: string;
  toolCalls?: Array<{
    name: string;
    args: unknown;
  }>;
};

/**
 * HITL approval response
 */
export type HITLApprovalResponse = {
  taskId: string;
  approved: boolean;
  reason?: string;
};

/**
 * Risk detection patterns
 */
const HIGH_RISK_PATTERNS = {
  commands: [
    /rm\s+-rf/i,
    /git\s+reset\s+--hard/i,
    /git\s+push\s+--force/i,
    /git\s+push\s+-f/i,
    /git\s+clean\s+-fd/i,
    /dd\s+if=/i,
    /mkfs\./i,
    /format\s+/i,
    /del\s+\/[sf]/i,
    /rmdir\s+\/s/i
  ],
  tools: [
    "execute_bash",
    "write_to_file",
    "delete_file"
  ],
  paths: [
    /^\/(?!mnt\/workspace)/i, // Paths outside /mnt/workspace
    /\.\.\//,                  // Parent directory traversal
    /^~\//,                    // Home directory
    /^\/etc\//i,               // System config
    /^\/usr\//i,               // System binaries
    /^\/var\//i                // System data
  ]
};

const MEDIUM_RISK_PATTERNS = {
  commands: [
    /git\s+push/i,
    /npm\s+publish/i,
    /curl\s+/i,
    /wget\s+/i,
    /chmod\s+/i,
    /chown\s+/i
  ],
  tools: [
    "network_request",
    "install_package"
  ]
};

/**
 * Human-in-the-Loop (HITL) middleware
 * Intercepts high-risk operations and requests user approval
 */
export class HITLMiddleware implements Middleware {
  name = "hitl";
  private eventEmitter: EventEmitter;
  private pendingApprovals: Map<string, Promise<HITLApprovalResponse>> = new Map();

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
  }

  /**
   * Check for high-risk operations after LLM response
   */
  async afterLLM(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    // Skip if no tool calls
    if (!ctx.llmResponse?.toolCalls || ctx.llmResponse.toolCalls.length === 0) {
      return ctx;
    }

    // Detect risk level
    const riskAssessment = this.assessRisk(ctx);

    if (riskAssessment.level === "low") {
      return ctx;
    }

    // Request approval for medium/high risk operations
    const approved = await this.requestApproval(ctx, riskAssessment);

    if (!approved) {
      // User rejected - abort execution
      return {
        ...ctx,
        metadata: {
          ...ctx.metadata,
          hitlRejected: true,
          hitlReason: riskAssessment.reason
        },
        llmResponse: {
          ...ctx.llmResponse,
          toolCalls: [] // Clear tool calls to prevent execution
        }
      };
    }

    // User approved - continue
    return {
      ...ctx,
      metadata: {
        ...ctx.metadata,
        hitlApproved: true,
        hitlRisk: riskAssessment.level
      }
    };
  }

  /**
   * Assess risk level of operations
   */
  private assessRisk(ctx: MiddlewareContext): {
    level: RiskLevel;
    reason: string;
    operations: string[];
  } {
    const operations: string[] = [];
    let highestRisk: RiskLevel = "low";
    let reason = "";

    if (!ctx.llmResponse?.toolCalls) {
      return { level: "low", reason: "", operations: [] };
    }

    for (const toolCall of ctx.llmResponse.toolCalls) {
      const toolName = toolCall.name;
      const args = toolCall.arguments;

      // Check tool name against patterns
      if (HIGH_RISK_PATTERNS.tools.includes(toolName)) {
        highestRisk = "high";
        operations.push(toolName);
      } else if (MEDIUM_RISK_PATTERNS.tools.includes(toolName)) {
        if (highestRisk !== "high") {
          highestRisk = "medium";
        }
        operations.push(toolName);
      }

      // Check command content for bash execution
      if (toolName === "execute_bash" && typeof args.command === "string") {
        const command = args.command;

        // Check high-risk command patterns
        for (const pattern of HIGH_RISK_PATTERNS.commands) {
          if (pattern.test(command)) {
            highestRisk = "high";
            reason = `Destructive command detected: ${command}`;
            operations.push(command);
            break;
          }
        }

        // Check medium-risk command patterns
        if (highestRisk !== "high") {
          for (const pattern of MEDIUM_RISK_PATTERNS.commands) {
            if (pattern.test(command)) {
              highestRisk = "medium";
              reason = `Potentially risky command: ${command}`;
              operations.push(command);
              break;
            }
          }
        }
      }

      // Check file paths for write operations
      if (toolName === "write_to_file" && typeof args.path === "string") {
        const filePath = args.path;

        for (const pattern of HIGH_RISK_PATTERNS.paths) {
          if (pattern.test(filePath)) {
            highestRisk = "high";
            reason = `File write outside workspace: ${filePath}`;
            operations.push(`write: ${filePath}`);
            break;
          }
        }
      }
    }

    if (!reason && highestRisk !== "low") {
      reason = `${highestRisk} risk operations detected`;
    }

    return { level: highestRisk, reason, operations };
  }

  /**
   * Request user approval for risky operations
   */
  private async requestApproval(
    ctx: MiddlewareContext,
    riskAssessment: { level: RiskLevel; reason: string; operations: string[] }
  ): Promise<boolean> {
    const request: HITLApprovalRequest = {
      taskId: ctx.taskId,
      operation: riskAssessment.operations.join(", "),
      risk: riskAssessment.level,
      details: riskAssessment.reason,
      toolCalls: ctx.llmResponse?.toolCalls?.map((tc) => ({
        name: tc.name,
        args: tc.arguments
      }))
    };

    // Create promise for approval response
    const approvalPromise = new Promise<HITLApprovalResponse>((resolve) => {
      // Set up one-time listener for approval response
      const handler = (response: HITLApprovalResponse) => {
        if (response.taskId === ctx.taskId) {
          this.eventEmitter.off("hitl:approval-response", handler);
          resolve(response);
        }
      };

      this.eventEmitter.on("hitl:approval-response", handler);

      // Timeout after 5 minutes
      setTimeout(() => {
        this.eventEmitter.off("hitl:approval-response", handler);
        resolve({ taskId: ctx.taskId, approved: false, reason: "Timeout" });
      }, 5 * 60 * 1000);
    });

    this.pendingApprovals.set(ctx.taskId, approvalPromise);

    // Emit approval request to renderer
    this.eventEmitter.emit("hitl:approval-required", request);

    // Wait for user decision
    const response = await approvalPromise;
    this.pendingApprovals.delete(ctx.taskId);

    return response.approved;
  }

  /**
   * Submit approval response (called from IPC handler)
   */
  submitApproval(response: HITLApprovalResponse): void {
    this.eventEmitter.emit("hitl:approval-response", response);
  }

  /**
   * Get pending approval requests
   */
  getPendingApprovals(): string[] {
    return Array.from(this.pendingApprovals.keys());
  }
}
