import { EventEmitter } from "node:events";
import type { AppConfig } from "../config";
import type { ToolPlanningChatAgent } from "./tool-planning-chat-agent";
import { MiddlewarePipeline, WorkspaceMiddleware, ValidationMiddleware, HITLMiddleware, MemoryMiddleware } from "./middleware";
import { createSessionContext } from "./session";
import type { ChatV2SendInput, ChatV2SendResult, HITLApprovalResponse } from "../../shared/ipc";
import type { LlmMessage } from "../models/types";
import type { MemoryProvider } from "../memory/types";

/**
 * Chat agent with middleware pipeline
 * Wraps the existing ToolPlanningChatAgent with middleware support
 */
export class MiddlewareChatAgent {
  private pipeline: MiddlewarePipeline;
  private eventEmitter: EventEmitter;
  private hitlMiddleware?: HITLMiddleware;

  constructor(
    private config: AppConfig,
    private baseChatAgent: ToolPlanningChatAgent,
    private memoryProvider?: MemoryProvider
  ) {
    this.eventEmitter = new EventEmitter();
    this.pipeline = new MiddlewarePipeline();
    this.setupMiddlewares();
  }

  /**
   * Setup middleware pipeline
   */
  private setupMiddlewares(): void {
    const workspacesPath = this.config.paths.workspaceDir;

    // Register middlewares in order
    this.pipeline.use(new WorkspaceMiddleware(workspacesPath));
    this.pipeline.use(new ValidationMiddleware(3));
    if (this.config.features.enableMemory && this.memoryProvider) {
      this.pipeline.use(new MemoryMiddleware(this.memoryProvider));
    }

    // Create and register HITL middleware
    this.hitlMiddleware = new HITLMiddleware(this.eventEmitter);
    this.pipeline.use(this.hitlMiddleware);
  }

  /**
   * Get event emitter for HITL events
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  /**
   * Submit HITL approval response
   */
  submitHITLApproval(response: HITLApprovalResponse): void {
    if (this.hitlMiddleware) {
      this.hitlMiddleware.submitApproval(response);
    }
  }

  /**
   * Send chat message with middleware pipeline
   */
  async send(input: ChatV2SendInput): Promise<ChatV2SendResult> {
    const startTime = Date.now();

    // Convert history to LlmMessage format
    const messages: LlmMessage[] = [
      ...input.history.map((msg) => ({
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content
      })),
      {
        role: "user" as const,
        content: input.message
      }
    ];

    // Create initial context
    const initialContext = createSessionContext({
      sessionId: input.requestId,
      messages
    });

    // Execute pipeline
    const finalContext = await this.pipeline.execute(initialContext, async (ctx) => {
      const chatInput = this.toToolPlanningChatInput(ctx, input);

      // Execute base chat agent
      const result = await this.baseChatAgent.send(chatInput);

      // Populate LLM response in context
      return {
        ...ctx,
        llmResponse: {
          content: result.reply,
          toolCalls: []
        },
        metadata: {
          ...ctx.metadata,
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs
        }
      };
    });

    const latencyMs = Date.now() - startTime;

    return {
      reply: finalContext.llmResponse?.content || "",
      provider: (finalContext.metadata.provider as any) || "deepseek",
      model: (finalContext.metadata.model as string) || "deepseek-chat",
      latencyMs,
      middlewareUsed: this.pipeline.getMiddlewareNames(),
      workspacePath: finalContext.workspacePath
    };
  }

  /**
   * Convert middleware context back into tool-planning chat input.
   * Uses the last user message as "message" and keeps preceding messages as history.
   */
  private toToolPlanningChatInput(
    ctx: { messages: LlmMessage[] },
    fallback: ChatV2SendInput
  ): { message: string; history: Array<{ role: "system" | "user" | "assistant"; content: string }> } {
    for (let i = ctx.messages.length - 1; i >= 0; i -= 1) {
      const message = ctx.messages[i];
      if (message.role === "user") {
        return {
          message: message.content,
          history: ctx.messages.slice(0, i).map((item) => ({
            role: item.role,
            content: item.content
          }))
        };
      }
    }

    return {
      message: fallback.message,
      history: fallback.history.map((item) => ({
        role: item.role as "system" | "user" | "assistant",
        content: item.content
      }))
    };
  }
}
