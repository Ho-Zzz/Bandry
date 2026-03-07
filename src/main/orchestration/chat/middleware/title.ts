import { resolveRuntimeTarget } from "../../../llm/runtime/runtime-target";
import type { Middleware, MiddlewareContext } from "./types";

const MAX_TITLE_LEN = 48;
const POLITE_PREFIX_PATTERN =
  /^(?:请你|请帮我|帮我|请问|麻烦你|麻烦|我想让你|我想请你|我想|我需要|请|help me(?:\s+to)?|please|can you|could you)\s*/i;
const TRAILING_ENDING_PATTERN = /(?:吗|么|嘛|呢|吧|呀|啊|呗)\s*$/;

const truncateTitle = (title: string): string => {
  const normalized = title.replace(/\s+/g, " ").trim();
  // Remove quotes if present
  const unquoted = normalized.replace(/^["']|["']$/g, "");
  if (unquoted.length <= MAX_TITLE_LEN) {
    return unquoted;
  }
  return `${unquoted.slice(0, MAX_TITLE_LEN - 1)}…`;
};

const stripPolitePrefix = (input: string): string => {
  let candidate = input.trim();
  for (let i = 0; i < 2; i += 1) {
    const next = candidate.replace(POLITE_PREFIX_PATTERN, "").trim();
    if (next === candidate) {
      break;
    }
    candidate = next;
  }
  return candidate;
};

const deriveIntentPhrase = (userMessage: string): string => {
  const normalized = userMessage.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const firstClause = normalized.split(/[。！？!?]/)[0]?.trim() ?? normalized;
  const deprefixed = stripPolitePrefix(firstClause);
  const softened = deprefixed.replace(TRAILING_ENDING_PATTERN, "").trim();

  if (softened.length >= 4) {
    return softened;
  }

  if (deprefixed.length >= 4) {
    return deprefixed;
  }

  return normalized;
};

const generateFallbackTitle = (userMessage: string): string => {
  const intentPhrase = deriveIntentPhrase(userMessage);
  if (intentPhrase) {
    return truncateTitle(intentPhrase);
  }

  // If message is too long, try to extract the core intent
  if (userMessage.length > MAX_TITLE_LEN) {
    // Try to find the first sentence or clause
    const firstSentence = userMessage.split(/[。！？,.!?]/)[0];
    if (firstSentence && firstSentence.length < userMessage.length) {
      return truncateTitle(firstSentence);
    }
  }

  return truncateTitle(userMessage);
};

const extractTemporaryTitle = (userMessage: string): string => {
  const intentPhrase = deriveIntentPhrase(userMessage);
  if (intentPhrase) {
    return truncateTitle(intentPhrase);
  }
  return generateFallbackTitle(userMessage);
};

const shouldSkipModelTitleGeneration = (
  userMessage: string,
  assistantReply: string
): boolean => {
  return userMessage.length <= 8 && assistantReply.length < 48;
};

export class TitleMiddleware implements Middleware {
  name = "title";

  async afterAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    const runtime = ctx.runtime;
    if (!runtime?.conversationStore || !ctx.conversationId) {
      return ctx;
    }
    const conversationStore = runtime.conversationStore;

    const conversation = runtime.conversationStore.getConversation(ctx.conversationId);
    if (!conversation || (conversation.title && conversation.title.trim().length > 0)) {
      return ctx;
    }

    const currentUser = [...ctx.messages]
      .reverse()
      .find((message) => message.role === "user")
      ?.content
      ?.trim();
    const assistantReply = ctx.finalResponse?.trim();
    if (!currentUser || !assistantReply) {
      return ctx;
    }

    const conversationId = ctx.conversationId;

    // Write a temporary title first for immediate UI feedback.
    const temporaryTitle = extractTemporaryTitle(currentUser);
    if (temporaryTitle) {
      const updatedConversation = conversationStore.updateConversation(conversationId, { title: temporaryTitle });
      if (updatedConversation) {
        runtime.onConversationUpdated?.(updatedConversation);
      }
    }

    if (shouldSkipModelTitleGeneration(currentUser, assistantReply)) {
      if (!temporaryTitle) {
        const fallbackTitle = generateFallbackTitle(currentUser);
        if (fallbackTitle) {
          const updatedConversation = conversationStore.updateConversation(conversationId, { title: fallbackTitle });
          if (updatedConversation) {
            runtime.onConversationUpdated?.(updatedConversation);
          }
        }
      }
      return ctx;
    }

    void this.generateTitleAsync(runtime, conversationId, currentUser, assistantReply, temporaryTitle);

    return ctx;
  }

  private async generateTitleAsync(
    runtime: MiddlewareContext["runtime"],
    conversationId: string,
    currentUser: string,
    assistantReply: string,
    temporaryTitle: string
  ): Promise<void> {
    if (!runtime) {
      return;
    }

    const conversationStore = runtime.conversationStore;
    if (!conversationStore) {
      return;
    }
    let title = "";
    try {
      const target = resolveRuntimeTarget(runtime.config, "lead.synthesizer");

      // Create a new AbortController for title generation
      // This ensures title generation won't be affected by the main request's abort signal
      const titleAbortController = new AbortController();
      const timeoutId = setTimeout(() => titleAbortController.abort(), 3000); // Reduced to 3s timeout

      try {
        const result = await runtime.modelsFactory.generateText({
          runtimeConfig: target.runtimeConfig,
          model: target.model,
          temperature: 0.3,
          maxTokens: 60,
          messages: [
            {
              role: "system",
              content:
                "You are a conversation title generator. Based on the user's request and assistant's reply, generate a concise and meaningful title that captures the core theme or task of the conversation.\n\nRequirements:\n- Output the title text directly without quotes\n- Maximum 48 characters\n- Focus on the core intent or theme, not just repeating the user message\n- Use verb-object structure or noun phrases\n- Avoid redundant words (like 'help me', 'please', etc.)\n\nExamples:\nUser: Help me analyze today's stock market\nAssistant: Today's stock market...\nTitle: Stock Market Analysis\n\nUser: Write a Python script to read CSV files\nAssistant: Here's a script to read CSV...\nTitle: CSV File Reader Script"
            },
            {
              role: "user",
              content: `Current user message: ${currentUser.slice(0, 300)}\nCurrent assistant reply: ${assistantReply.slice(0, 400)}`
            }
          ],
          abortSignal: titleAbortController.signal
        });
        clearTimeout(timeoutId);
        title = truncateTitle(result.text);

        // If model returns empty content, use fallback
        if (!title || title.trim().length === 0) {
          title = generateFallbackTitle(currentUser);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch {
      // If LLM fails, generate a smarter fallback title
      title = generateFallbackTitle(currentUser);
      // Don't log errors to reduce noise
    }

    if (!title || title.trim().length === 0) {
      return;
    }

    if (title !== temporaryTitle) {
      const updatedConversation = conversationStore.updateConversation(conversationId, { title });
      if (updatedConversation) {
        runtime.onConversationUpdated?.(updatedConversation);
      }
    }
  }
}
