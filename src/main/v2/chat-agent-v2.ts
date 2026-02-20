import { EventEmitter } from "node:events";
import type { AppConfig } from "../config";
import type { DeepSeekToolChatAgent } from "../chat";
import { MiddlewarePipeline, WorkspaceMiddleware, ValidationMiddleware, HITLMiddleware } from "./middleware";
import { createSessionContext } from "./session";
import type { ChatV2SendInput, ChatV2SendResult, HITLApprovalResponse } from "../../shared/ipc";
import type { LlmMessage } from "../models/types";

/**
 * V2 Chat Agent with middleware pipeline
 * Wraps the existing DeepSeekToolChatAgent with middleware support
 */
export class ChatAgentV2 {
  private pipeline: MiddlewarePipeline;
  private eventEmitter: EventEmitter;
  private hitlMiddleware?: HITLMiddleware;

  constructor(
    private config: AppConfig,
    private legacyAgent: DeepSeekToolChatAgent
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
      // Execute legacy agent
      const result = await this.legacyAgent.send({
        message: input.message,
        history: input.history
      });

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
}
