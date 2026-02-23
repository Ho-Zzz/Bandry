import { resolveRuntimeTarget } from "../../../llm/runtime/runtime-target";
import type { Middleware, MiddlewareContext } from "./types";

const MAX_TITLE_LEN = 32;

const truncateTitle = (title: string): string => {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_TITLE_LEN) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_TITLE_LEN - 1)}…`;
};

export class TitleMiddleware implements Middleware {
  name = "title";

  async afterAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    const runtime = ctx.runtime;
    if (!runtime?.conversationStore || !ctx.conversationId) {
      return ctx;
    }

    const conversation = runtime.conversationStore.getConversation(ctx.conversationId);
    if (!conversation || (conversation.title && conversation.title.trim().length > 0)) {
      return ctx;
    }

    const firstUser = ctx.messages.find((message) => message.role === "user")?.content?.trim();
    const assistantReply = ctx.finalResponse?.trim();
    if (!firstUser || !assistantReply) {
      return ctx;
    }

    let title = "";
    try {
      const target = resolveRuntimeTarget(runtime.config, "lead.synthesizer");
      const result = await runtime.modelsFactory.generateText({
        runtimeConfig: target.runtimeConfig,
        model: target.model,
        temperature: 0,
        maxTokens: 40,
        messages: [
          {
            role: "system",
            content:
              "Generate a concise conversation title. Output plain text only, no quotes, max 32 characters."
          },
          {
            role: "user",
            content: `User request: ${firstUser}\nAssistant reply: ${assistantReply}`
          }
        ],
        abortSignal: runtime.abortSignal
      });
      title = truncateTitle(result.text);
    } catch {
      title = truncateTitle(firstUser);
    }

    if (!title) {
      return ctx;
    }

    runtime.conversationStore.updateConversation(ctx.conversationId, { title });
    runtime.onUpdate?.("final", `title updated: ${title}`);
    return {
      ...ctx,
      metadata: {
        ...ctx.metadata,
        titleGenerated: true,
        generatedTitle: title
      }
    };
  }
}
