import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

export const openSqliteDatabase = (dbPath: string, schemaPath: string): Database.Database => {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);

  return db;
};
