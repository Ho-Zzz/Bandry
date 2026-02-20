import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { WorkspaceMiddleware } from "./workspace";
import type { MiddlewareContext } from "./types";

describe("WorkspaceMiddleware", () => {
  let tempDir: string;
  let middleware: WorkspaceMiddleware;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bandry-test-"));
    middleware = new WorkspaceMiddleware(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should create workspace directory structure", async () => {
    const ctx: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task-123",
      workspacePath: "",
      messages: [],
      tools: [],
      metadata: {},
      state: "request"
    };

    const result = await middleware.onRequest(ctx);

    // Check workspace path is set
    expect(result.workspacePath).toBe(path.join(tempDir, "task_test-task-123"));

    // Check directories exist
    const workspacePath = result.workspacePath;
    const inputDir = path.join(workspacePath, "input");
    const stagingDir = path.join(workspacePath, "staging");
    const outputDir = path.join(workspacePath, "output");

    const [inputExists, stagingExists, outputExists] = await Promise.all([
      fs.access(inputDir).then(() => true).catch(() => false),
      fs.access(stagingDir).then(() => true).catch(() => false),
      fs.access(outputDir).then(() => true).catch(() => false)
    ]);

    expect(inputExists).toBe(true);
    expect(stagingExists).toBe(true);
    expect(outputExists).toBe(true);
  });

  it("should add workspace metadata to context", async () => {
    const ctx: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task-456",
      workspacePath: "",
      messages: [],
      tools: [],
      metadata: {},
      state: "request"
    };

    const result = await middleware.onRequest(ctx);

    expect(result.metadata.workspaceCreated).toBe(true);
    expect(result.metadata.workspaceStructure).toBeDefined();

    const structure = result.metadata.workspaceStructure as any;
    expect(structure.input).toContain("input");
    expect(structure.staging).toContain("staging");
    expect(structure.output).toContain("output");
  });

  it("should handle existing workspace gracefully", async () => {
    const ctx: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task-789",
      workspacePath: "",
      messages: [],
      tools: [],
      metadata: {},
      state: "request"
    };

    // Create workspace first time
    await middleware.onRequest(ctx);

    // Create workspace second time (should not error)
    const result = await middleware.onRequest(ctx);

    expect(result.workspacePath).toBe(path.join(tempDir, "task_test-task-789"));
  });

  it("should cleanup old workspaces", async () => {
    // Create old workspace
    const oldTaskId = "old-task";
    const oldWorkspacePath = path.join(tempDir, `task_${oldTaskId}`);
    await fs.mkdir(oldWorkspacePath, { recursive: true });

    // Set old modification time (2 days ago)
    const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
    await fs.utimes(oldWorkspacePath, new Date(twoDaysAgo), new Date(twoDaysAgo));

    // Create new workspace
    const newTaskId = "new-task";
    const newWorkspacePath = path.join(tempDir, `task_${newTaskId}`);
    await fs.mkdir(newWorkspacePath, { recursive: true });

    // Cleanup workspaces older than 1 day
    const oneDayMs = 24 * 60 * 60 * 1000;
    const cleaned = await middleware.cleanupOldWorkspaces(oneDayMs);

    expect(cleaned).toBe(1);

    // Check old workspace is deleted
    const oldExists = await fs.access(oldWorkspacePath).then(() => true).catch(() => false);
    expect(oldExists).toBe(false);

    // Check new workspace still exists
    const newExists = await fs.access(newWorkspacePath).then(() => true).catch(() => false);
    expect(newExists).toBe(true);
  });
});
