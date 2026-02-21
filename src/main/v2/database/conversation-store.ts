import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type {
  ConversationRecord,
  MessageRecord,
  CreateConversationInput,
  UpdateConversationInput,
  CreateMessageInput,
  UpdateMessageInput
} from "./types";

/**
 * Conversation store
 * Manages conversations and messages in SQLite
 */
export class ConversationStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    this.db.exec(schema);
  }

  // ==================== Conversation Methods ====================

  createConversation(input: CreateConversationInput): ConversationRecord {
    const id = randomUUID();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, title, model_profile_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, input.title || null, input.model_profile_id || null, now, now);

    return this.getConversation(id)!;
  }

  getConversation(id: string): ConversationRecord | null {
    const stmt = this.db.prepare(`SELECT * FROM conversations WHERE id = ?`);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToConversation(row);
  }

  listConversations(limit = 50, offset = 0): ConversationRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset) as Record<string, unknown>[];
    return rows.map((row) => this.rowToConversation(row));
  }

  updateConversation(id: string, input: UpdateConversationInput): ConversationRecord | null {
    const existing = this.getConversation(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.title !== undefined) {
      updates.push("title = ?");
      values.push(input.title || null);
    }

    if (input.model_profile_id !== undefined) {
      updates.push("model_profile_id = ?");
      values.push(input.model_profile_id || null);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push("updated_at = ?");
    values.push(Date.now());
    values.push(id);

    const sql = `UPDATE conversations SET ${updates.join(", ")} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    stmt.run(...values);

    return this.getConversation(id);
  }

  deleteConversation(id: string): boolean {
    const stmt = this.db.prepare("DELETE FROM conversations WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  private rowToConversation(row: Record<string, unknown>): ConversationRecord {
    return {
      id: row.id as string,
      title: (row.title as string) || undefined,
      model_profile_id: (row.model_profile_id as string) || undefined,
      created_at: row.created_at as number,
      updated_at: row.updated_at as number
    };
  }

  // ==================== Message Methods ====================

  createMessage(input: CreateMessageInput): MessageRecord {
    const id = randomUUID();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, status, trace, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.conversation_id,
      input.role,
      input.content,
      input.status || "completed",
      input.trace || null,
      now
    );

    // Update conversation's updated_at
    this.db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now, input.conversation_id);

    return this.getMessage(id)!;
  }

  getMessage(id: string): MessageRecord | null {
    const stmt = this.db.prepare(`SELECT * FROM messages WHERE id = ?`);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToMessage(row);
  }

  listMessages(conversationId: string): MessageRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(conversationId) as Record<string, unknown>[];
    return rows.map((row) => this.rowToMessage(row));
  }

  updateMessage(id: string, input: UpdateMessageInput): MessageRecord | null {
    const existing = this.getMessage(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.content !== undefined) {
      updates.push("content = ?");
      values.push(input.content);
    }

    if (input.status !== undefined) {
      updates.push("status = ?");
      values.push(input.status);
    }

    if (input.trace !== undefined) {
      updates.push("trace = ?");
      values.push(input.trace || null);
    }

    if (updates.length === 0) {
      return existing;
    }

    values.push(id);

    const sql = `UPDATE messages SET ${updates.join(", ")} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    stmt.run(...values);

    return this.getMessage(id);
  }

  deleteMessage(id: string): boolean {
    const stmt = this.db.prepare("DELETE FROM messages WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  private rowToMessage(row: Record<string, unknown>): MessageRecord {
    return {
      id: row.id as string,
      conversation_id: row.conversation_id as string,
      role: row.role as MessageRecord["role"],
      content: row.content as string,
      status: row.status as MessageRecord["status"],
      trace: (row.trace as string) || undefined,
      created_at: row.created_at as number
    };
  }

  close(): void {
    this.db.close();
  }
}
