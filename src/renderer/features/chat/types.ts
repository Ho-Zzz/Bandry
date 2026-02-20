export type PingState = "idle" | "checking" | "ok" | "error";
export type ChatRole = "assistant" | "user" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  pending?: boolean;
  meta?: string;
};
