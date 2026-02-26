/**
 * Message status
 */
export type MessageStatus = "pending" | "completed" | "error";

/**
 * Message role
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * Conversation record (stored in database)
 */
export type ConversationRecord = {
  id: string;
  title?: string;
  model_profile_id?: string;
  workspace_path?: string;
  created_at: number;
  updated_at: number;
};

/**
 * Message record (stored in database)
 */
export type MessageRecord = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  trace?: string; // JSON string of trace events
  created_at: number;
};

/**
 * Input for creating a conversation
 */
export type CreateConversationInput = {
  title?: string;
  model_profile_id?: string;
};

/**
 * Input for updating a conversation
 */
export type UpdateConversationInput = Partial<CreateConversationInput> & {
  workspace_path?: string;
};

/**
 * Input for creating a message
 */
export type CreateMessageInput = {
  conversation_id: string;
  role: MessageRole;
  content: string;
  status?: MessageStatus;
  trace?: string;
};

/**
 * Input for updating a message
 */
export type UpdateMessageInput = {
  content?: string;
  status?: MessageStatus;
  trace?: string;
};
