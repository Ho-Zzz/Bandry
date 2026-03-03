import { resolveRuntimeTarget } from "../../../llm/runtime/runtime-target";
import type { Middleware, MiddlewareContext } from "./types";

const MAX_TITLE_LEN = 48;

const truncateTitle = (title: string): string => {
  const normalized = title.replace(/\s+/g, " ").trim();
  // Remove quotes if present
  const unquoted = normalized.replace(/^["']|["']$/g, "");
  if (unquoted.length <= MAX_TITLE_LEN) {
    return unquoted;
  }
  return `${unquoted.slice(0, MAX_TITLE_LEN - 1)}…`;
};

const generateFallbackTitle = (userMessage: string): string => {
  // Extract key action verbs and nouns for a more meaningful title
  const message = userMessage.toLowerCase();

  // Common patterns to extract intent
  if (message.includes("帮我") || message.includes("请")) {
    // Extract the main action after "帮我" or "请"
    const match = message.match(/(?:帮我|请)(.{1,30})/);
    if (match?.[1]) {
      return truncateTitle(match[1].trim());
    }
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

    // Generate title asynchronously to avoid blocking the main response
    const conversationId = ctx.conversationId;
    void this.generateTitleAsync(runtime, conversationId, firstUser, assistantReply);

    return ctx;
  }

  private async generateTitleAsync(
    runtime: MiddlewareContext["runtime"],
    conversationId: string,
    firstUser: string,
    assistantReply: string
  ): Promise<void> {
    if (!runtime) {
      return;
    }

    // For very short conversations (greetings, simple Q&A), skip LLM and use fallback directly
    const isSimpleConversation = firstUser.length < 30 || assistantReply.length < 150;
    if (isSimpleConversation) {
      const title = generateFallbackTitle(firstUser);
      if (title && title.trim().length > 0) {
        runtime.conversationStore.updateConversation(conversationId, { title });
        // Don't emit update for simple conversations to reduce noise
      }
      return;
    }

    let title = "";
    try {
      const target = resolveRuntimeTarget(runtime.config, "lead.synthesizer");

      // Skip title generation if using slow reasoning models
      const isReasoningModel = target.model.toLowerCase().includes('reasoner') ||
                               target.model.toLowerCase().includes('o1') ||
                               target.model.toLowerCase().includes('o3');
      if (isReasoningModel) {
        title = generateFallbackTitle(firstUser);
        runtime.conversationStore.updateConversation(conversationId, { title });
        return;
      }

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
              content: `User request: ${firstUser.slice(0, 200)}\nAssistant reply: ${assistantReply.slice(0, 300)}`
            }
          ],
          abortSignal: titleAbortController.signal
        });
        clearTimeout(timeoutId);
        title = truncateTitle(result.text);

        // If model returns empty content, use fallback
        if (!title || title.trim().length === 0) {
          title = generateFallbackTitle(firstUser);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      // If LLM fails, generate a smarter fallback title
      title = generateFallbackTitle(firstUser);
      // Don't log errors to reduce noise
    }

    if (!title || title.trim().length === 0) {
      return;
    }

    runtime.conversationStore.updateConversation(conversationId, { title });
    // Don't emit update to reduce trace noise
  }
}
