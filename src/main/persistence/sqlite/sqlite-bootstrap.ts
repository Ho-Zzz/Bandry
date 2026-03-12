import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

const runMigrations = (db: Database.Database): void => {
  // Add workspace_path to conversations if missing (added in v0.1.1)
  const columns = db.pragma("table_info(conversations)") as Array<{ name: string }>;
  const hasWorkspacePath = columns.some((col) => col.name === "workspace_path");
  if (!hasWorkspacePath) {
    db.exec("ALTER TABLE conversations ADD COLUMN workspace_path TEXT");
  }
};

export const openSqliteDatabase = (dbPath: string, schemaPath: string): Database.Database => {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);
  runMigrations(db);

  return db;
};
