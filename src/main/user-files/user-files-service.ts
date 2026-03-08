import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import type Database from "better-sqlite3";
import type { OpenVikingHttpClient } from "../memory/openviking/http-client";
import type { ConversationExporter } from "./conversation-exporter";
import type { UserFileRecord, FileEntry } from "./types";

export class UserFilesService {
  private readonly userFilesDir: string;

  constructor(
    private readonly db: Database.Database,
    resourcesDir: string,
    private readonly conversationExporter: ConversationExporter,
    private readonly openVikingClient?: OpenVikingHttpClient
  ) {
    this.userFilesDir = path.join(resourcesDir, "user-files");
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.userFilesDir, { recursive: true });
  }

  async createDirectory(dirPath: string): Promise<void> {
    const fullPath = path.join(this.userFilesDir, dirPath);
    await fs.mkdir(fullPath, { recursive: true });
  }

  async saveFile(filePath: string, content: string | Buffer): Promise<UserFileRecord> {
    // 1. Save local file
    const fullPath = path.join(this.userFilesDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);

    // 2. Calculate file size
    const sizeBytes = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content);

    // 3. Insert database record
    const record: UserFileRecord = {
      id: randomUUID(),
      file_path: filePath,
      size_bytes: sizeBytes,
      mime_type: this.getMimeType(filePath),
      viking_uri: null,
      viking_synced_at: null,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    this.db
      .prepare(
        `INSERT INTO user_files (id, file_path, size_bytes, mime_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.id,
        record.file_path,
        record.size_bytes,
        record.mime_type,
        record.created_at,
        record.updated_at
      );

    // 4. Sync to OpenViking (async, non-blocking)
    this.syncToOpenViking(record.id, fullPath).catch((error) => {
      console.error(`Failed to sync file to OpenViking: ${filePath}`, error);
    });

    return record;
  }

  async listDirectory(dirPath: string = ""): Promise<FileEntry[]> {
    const fullPath = path.join(this.userFilesDir, dirPath);

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const fileEntries: FileEntry[] = [];

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const fullEntryPath = path.join(fullPath, entry.name);

        if (entry.isDirectory()) {
          fileEntries.push({
            name: entry.name,
            path: entryPath,
            type: "directory"
          });
        } else {
          const stats = await fs.stat(fullEntryPath);
          const record = this.db
            .prepare("SELECT * FROM user_files WHERE file_path = ?")
            .get(entryPath) as UserFileRecord | undefined;

          fileEntries.push({
            name: entry.name,
            path: entryPath,
            type: "file",
            size: stats.size,
            mimeType: record?.mime_type ?? this.getMimeType(entry.name),
            createdAt: record?.created_at,
            updatedAt: record?.updated_at
          });
        }
      }

      return fileEntries;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async readFile(filePath: string): Promise<{ content: string; mimeType: string }> {
    const fullPath = path.join(this.userFilesDir, filePath);
    const content = await fs.readFile(fullPath, "utf-8");
    const mimeType = this.getMimeType(filePath);

    return { content, mimeType };
  }

  async delete(filePath: string, recursive: boolean = false): Promise<void> {
    // 1. Query database record
    const record = this.db
      .prepare("SELECT viking_uri FROM user_files WHERE file_path = ?")
      .get(filePath) as Pick<UserFileRecord, "viking_uri"> | undefined;

    // 2. Delete from OpenViking
    if (record?.viking_uri && this.openVikingClient) {
      try {
        await this.openVikingClient.rm(record.viking_uri, recursive);
      } catch (error) {
        console.error("Failed to delete from OpenViking:", error);
      }
    }

    // 3. Delete local file
    const fullPath = path.join(this.userFilesDir, filePath);
    await fs.rm(fullPath, { recursive, force: true });

    // 4. Delete database record
    this.db.prepare("DELETE FROM user_files WHERE file_path = ?").run(filePath);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    // 1. Rename local file
    const oldFullPath = path.join(this.userFilesDir, oldPath);
    const newFullPath = path.join(this.userFilesDir, newPath);
    await fs.mkdir(path.dirname(newFullPath), { recursive: true });
    await fs.rename(oldFullPath, newFullPath);

    // 2. Update database record
    this.db
      .prepare(
        `UPDATE user_files
         SET file_path = ?, updated_at = ?, viking_uri = NULL, viking_synced_at = NULL
         WHERE file_path = ?`
      )
      .run(newPath, Date.now(), oldPath);

    // 3. Re-sync to OpenViking
    const record = this.db
      .prepare("SELECT id FROM user_files WHERE file_path = ?")
      .get(newPath) as Pick<UserFileRecord, "id"> | undefined;

    if (record) {
      this.syncToOpenViking(record.id, newFullPath).catch((error) => {
        console.error(`Failed to sync renamed file to OpenViking: ${newPath}`, error);
      });
    }
  }

  async saveConversationAsMarkdown(
    conversationId: string,
    targetPath: string
  ): Promise<UserFileRecord> {
    const markdown = await this.conversationExporter.exportToMarkdown(conversationId);
    return await this.saveFile(targetPath, markdown);
  }

  private async syncToOpenViking(recordId: string, fullPath: string): Promise<void> {
    if (!this.openVikingClient) {
      return;
    }

    try {
      const result = await this.openVikingClient.addResource(fullPath);
      const vikingUri = result.root_uri;

      this.db
        .prepare(
          `UPDATE user_files
           SET viking_uri = ?, viking_synced_at = ?
           WHERE id = ?`
        )
        .run(vikingUri, Date.now(), recordId);
    } catch (error) {
      console.error("Failed to sync to OpenViking:", error);
      throw error;
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".json": "application/json",
      ".js": "text/javascript",
      ".ts": "text/typescript",
      ".html": "text/html",
      ".css": "text/css",
      ".xml": "application/xml",
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml"
    };

    return mimeTypes[ext] || "application/octet-stream";
  }
}
