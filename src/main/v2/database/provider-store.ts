import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type {
  ProviderRecord,
  CreateProviderInput,
  UpdateProviderInput
} from "./types";

/**
 * Provider store
 * Manages LLM provider credentials in SQLite
 */
export class ProviderStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initSchema();
  }

  /**
   * Initialize database schema
   */
  private initSchema(): void {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    this.db.exec(schema);
  }

  /**
   * Create a new provider
   */
  createProvider(input: CreateProviderInput): ProviderRecord {
    const id = randomUUID();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO providers (id, provider_name, api_key, base_url, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.provider_name,
      input.api_key,
      input.base_url || null,
      input.is_active !== false ? 1 : 0,
      now,
      now
    );

    return this.getProvider(id)!;
  }

  /**
   * Get provider by ID
   */
  getProvider(id: string): ProviderRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM providers WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.rowToProvider(row);
  }

  /**
   * List all providers
   */
  listProviders(activeOnly: boolean = false): ProviderRecord[] {
    const sql = activeOnly
      ? "SELECT * FROM providers WHERE is_active = 1 ORDER BY created_at DESC"
      : "SELECT * FROM providers ORDER BY created_at DESC";

    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as any[];

    return rows.map((row) => this.rowToProvider(row));
  }

  /**
   * Update provider
   */
  updateProvider(id: string, input: UpdateProviderInput): ProviderRecord | null {
    const existing = this.getProvider(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: any[] = [];

    if (input.api_key !== undefined) {
      updates.push("api_key = ?");
      values.push(input.api_key);
    }

    if (input.base_url !== undefined) {
      updates.push("base_url = ?");
      values.push(input.base_url || null);
    }

    if (input.is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(input.is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push("updated_at = ?");
    values.push(Date.now());
    values.push(id);

    const sql = `UPDATE providers SET ${updates.join(", ")} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    stmt.run(...values);

    return this.getProvider(id);
  }

  /**
   * Delete provider
   */
  deleteProvider(id: string): boolean {
    const stmt = this.db.prepare("DELETE FROM providers WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Convert database row to ProviderRecord
   */
  private rowToProvider(row: any): ProviderRecord {
    return {
      id: row.id,
      provider_name: row.provider_name,
      api_key: row.api_key,
      base_url: row.base_url || undefined,
      is_active: row.is_active === 1,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
