import type { ConversationStore } from "../persistence/sqlite";

export class ConversationExporter {
  constructor(private readonly conversationStore: ConversationStore) {}

  async exportToMarkdown(conversationId: string): Promise<string> {
    const conversation = await this.conversationStore.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const messages = await this.conversationStore.listMessages(conversationId);

    let markdown = `# ${conversation.title || "Untitled Conversation"}\n\n`;
    markdown += `**Created**: ${new Date(conversation.created_at).toLocaleString()}\n`;
    markdown += `**Updated**: ${new Date(conversation.updated_at).toLocaleString()}\n\n`;
    markdown += `---\n\n`;

    for (const msg of messages) {
      const role = msg.role === "user" ? "👤 User" : "🤖 Assistant";
      markdown += `## ${role}\n\n`;
      markdown += `${msg.content}\n\n`;
      markdown += `---\n\n`;
    }

    return markdown;
  }
}
