import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

const hasTable = (db: Database.Database, tableName: string): boolean => {
  const row = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { "1"?: number } | undefined;
  return !!row;
};

const runMigrations = (db: Database.Database): void => {
  // Conversations table migrations.
  if (hasTable(db, "conversations")) {
    const columns = db.pragma("table_info(conversations)") as Array<{ name: string }>;
    const hasWorkspacePath = columns.some((col) => col.name === "workspace_path");
    if (!hasWorkspacePath) {
      db.exec("ALTER TABLE conversations ADD COLUMN workspace_path TEXT");
    }
  }

  // Messages table migrations (token tracking).
  if (hasTable(db, "messages")) {
    const columns = db.pragma("table_info(messages)") as Array<{ name: string }>;
    const hasPromptTokens = columns.some((col) => col.name === "prompt_tokens");
    const hasCompletionTokens = columns.some((col) => col.name === "completion_tokens");
    const hasTotalTokens = columns.some((col) => col.name === "total_tokens");

    if (!hasPromptTokens) {
      db.exec("ALTER TABLE messages ADD COLUMN prompt_tokens INTEGER");
    }
    if (!hasCompletionTokens) {
      db.exec("ALTER TABLE messages ADD COLUMN completion_tokens INTEGER");
    }
    if (!hasTotalTokens) {
      db.exec("ALTER TABLE messages ADD COLUMN total_tokens INTEGER");
    }

    // Create index after ensuring total_tokens exists.
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_messages_tokens ON messages(total_tokens) WHERE total_tokens IS NOT NULL"
    );
  }
};

export const openSqliteDatabase = (dbPath: string, schemaPath: string): Database.Database => {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  // Run migrations first to avoid schema/index errors on older DBs.
  runMigrations(db);
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);

  return db;
};