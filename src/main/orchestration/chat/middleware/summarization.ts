import { resolveRuntimeTarget } from "../../../llm/runtime/runtime-target";
import type { LlmMessage } from "../../../llm/runtime/types";
import type { Middleware, MiddlewareContext } from "./types";

const MESSAGE_COUNT_THRESHOLD = 24;
const CHAR_THRESHOLD = 16_000;
const KEEP_RECENT_MESSAGES = 8;

const estimateChars = (messages: LlmMessage[]): number => {
  return messages.reduce((sum, message) => sum + message.content.length, 0);
};

const shouldSummarize = (messages: LlmMessage[]): boolean => {
  return messages.length > MESSAGE_COUNT_THRESHOLD || estimateChars(messages) > CHAR_THRESHOLD;
};

export class SummarizationMiddleware implements Middleware {
  name = "summarization";

  async beforeModel(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    if (!ctx.runtime) {
      return ctx;
    }

    const messages = ctx.messages;
    if (!shouldSummarize(messages)) {
      return ctx;
    }

    const leading = messages.slice(0, Math.max(0, messages.length - KEEP_RECENT_MESSAGES));
    const trailing = messages.slice(-KEEP_RECENT_MESSAGES);
    if (leading.length === 0) {
      return ctx;
    }

    ctx.runtime.onUpdate?.(
      "model",
      `summarization triggered: ${messages.length} messages, compressing history`
    );

    try {
      const target = resolveRuntimeTarget(ctx.runtime.config, "lead.synthesizer");
      const prompt = [
        "Summarize the conversation history for context compression.",
        "Keep facts, decisions, pending tasks, and unresolved issues.",
        "Output concise bullet points."
      ].join(" ");
      const sourceText = leading.map((item) => `${item.role}: ${item.content}`).join("\n");
      const summarized = await ctx.runtime.modelsFactory.generateText({
        runtimeConfig: target.runtimeConfig,
        model: target.model,
        temperature: 0,
        maxTokens: 600,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: sourceText }
        ],
        abortSignal: ctx.runtime.abortSignal
      });

      ctx.runtime.onUpdate?.(
        "model",
        `summarization applied: ${messages.length} -> ${trailing.length + 1} messages`
      );

      return {
        ...ctx,
        messages: [
          {
            role: "system",
            content: `Conversation summary:\n${summarized.text}`
          },
          ...trailing
        ],
        metadata: {
          ...ctx.metadata,
          summarizationApplied: true,
          summarizationOriginalMessages: messages.length,
          summarizationKeptMessages: trailing.length + 1
        }
      };
    } catch (error) {
      ctx.runtime.onUpdate?.(
        "model",
        `summarization failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        ...ctx,
        metadata: {
          ...ctx.metadata,
          summarizationApplied: false,
          summarizationError: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
}
