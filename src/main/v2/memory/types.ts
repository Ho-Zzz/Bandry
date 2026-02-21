/**
 * Memory layer types (OpenViking)
 */
export type MemoryLayer = "L0" | "L1" | "L2";

/**
 * L0: Summary/abstract
 * L1: Outline/structure
 * L2: Full content
 */
export type MemoryContent = {
  layer: MemoryLayer;
  content: string;
  path: string;
  lastModified: number;
};

/**
 * Context chunk for injection
 */
export type ContextChunk = {
  source: string;
  content: string;
  relevance?: number;
  layer: MemoryLayer;
};

/**
 * Fact extracted from conversation
 */
export type Fact = {
  id: string;
  content: string;
  source: string;
  timestamp: number;
  tags?: string[];
  confidence?: number;
};

/**
 * Conversation record for storage
 */
export type Conversation = {
  sessionId: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
    timestamp: number;
  }>;
  metadata?: Record<string, unknown>;
};

/**
 * Memory storage options
 */
export type MemoryStorageOptions = {
  debounceMs?: number;
  maxContextTokens?: number;
  preferredLayers?: MemoryLayer[];
};

/**
 * Memory provider contract for middleware integration.
 * Allows swapping local adapter with OpenViking sidecar-backed implementation.
 */
export interface MemoryProvider {
  injectContext(sessionId: string, query?: string): Promise<ContextChunk[]>;
  storeConversation(conversation: Conversation): Promise<void>;
  flush?(): Promise<void>;
}
