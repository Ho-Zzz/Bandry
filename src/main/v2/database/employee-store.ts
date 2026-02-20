import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type {
  EmployeeRecord,
  CreateEmployeeInput,
  UpdateEmployeeInput
} from "./types";

/**
 * Employee store
 * Manages digital employee (agent) configurations in SQLite
 */
export class EmployeeStore {
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
   * Create a new employee
   */
  createEmployee(input: CreateEmployeeInput): EmployeeRecord {
    const id = randomUUID();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO employees (
        id, name, avatar, type, provider_id, model_id,
        system_prompt, mcp_tools, override_params,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.name,
      input.avatar || null,
      input.type,
      input.provider_id,
      input.model_id,
      input.system_prompt || null,
      JSON.stringify(input.mcp_tools || []),
      input.override_params ? JSON.stringify(input.override_params) : null,
      now,
      now
    );

    return this.getEmployee(id)!;
  }

  /**
   * Get employee by ID
   */
  getEmployee(id: string): EmployeeRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM employees WHERE id = ?
    `);

    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.rowToEmployee(row);
  }

  /**
   * List all employees
   */
  listEmployees(providerId?: string): EmployeeRecord[] {
    const sql = providerId
      ? "SELECT * FROM employees WHERE provider_id = ? ORDER BY created_at DESC"
      : "SELECT * FROM employees ORDER BY created_at DESC";

    const stmt = this.db.prepare(sql);
    const rows = providerId ? stmt.all(providerId) : stmt.all();

    return (rows as any[]).map((row) => this.rowToEmployee(row));
  }

  /**
   * Update employee
   */
  updateEmployee(id: string, input: UpdateEmployeeInput): EmployeeRecord | null {
    const existing = this.getEmployee(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push("name = ?");
      values.push(input.name);
    }

    if (input.avatar !== undefined) {
      updates.push("avatar = ?");
      values.push(input.avatar || null);
    }

    if (input.type !== undefined) {
      updates.push("type = ?");
      values.push(input.type);
    }

    if (input.provider_id !== undefined) {
      updates.push("provider_id = ?");
      values.push(input.provider_id);
    }

    if (input.model_id !== undefined) {
      updates.push("model_id = ?");
      values.push(input.model_id);
    }

    if (input.system_prompt !== undefined) {
      updates.push("system_prompt = ?");
      values.push(input.system_prompt || null);
    }

    if (input.mcp_tools !== undefined) {
      updates.push("mcp_tools = ?");
      values.push(JSON.stringify(input.mcp_tools));
    }

    if (input.override_params !== undefined) {
      updates.push("override_params = ?");
      values.push(input.override_params ? JSON.stringify(input.override_params) : null);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push("updated_at = ?");
    values.push(Date.now());
    values.push(id);

    const sql = `UPDATE employees SET ${updates.join(", ")} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    stmt.run(...values);

    return this.getEmployee(id);
  }

  /**
   * Delete employee
   */
  deleteEmployee(id: string): boolean {
    const stmt = this.db.prepare("DELETE FROM employees WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Convert database row to EmployeeRecord
   */
  private rowToEmployee(row: any): EmployeeRecord {
    return {
      id: row.id,
      name: row.name,
      avatar: row.avatar || undefined,
      type: row.type,
      provider_id: row.provider_id,
      model_id: row.model_id,
      system_prompt: row.system_prompt || undefined,
      mcp_tools: row.mcp_tools ? JSON.parse(row.mcp_tools) : [],
      override_params: row.override_params ? JSON.parse(row.override_params) : undefined,
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
