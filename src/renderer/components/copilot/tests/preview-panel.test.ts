/**
 * Preview Panel Tests
 *
 * Tests for the preview store used by the preview panel.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { usePreviewStore } from "../../../store/use-preview-store";

// Mock window.api.sandboxReadFile
const mockSandboxReadFile = vi.fn();

vi.stubGlobal("window", {
  api: {
    sandboxReadFile: mockSandboxReadFile
  }
});

describe("usePreviewStore", () => {
  beforeEach(() => {
    usePreviewStore.setState({
      isOpen: false,
      filePath: null,
      fileName: null,
      content: null,
      loading: false,
      error: null,
      workspacePath: null,
      virtualRoot: "/mnt/workspace"
    });
    mockSandboxReadFile.mockReset();
  });

  it("starts in closed state", () => {
    const state = usePreviewStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.filePath).toBeNull();
    expect(state.fileName).toBeNull();
    expect(state.content).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("opens preview and loads file content", async () => {
    mockSandboxReadFile.mockResolvedValue({
      path: "/docs/readme.md",
      content: "# Hello World"
    });

    await usePreviewStore.getState().openPreview("/docs/readme.md", "readme.md");

    const state = usePreviewStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.filePath).toBe("/docs/readme.md");
    expect(state.fileName).toBe("readme.md");
    expect(state.content).toBe("# Hello World");
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(mockSandboxReadFile).toHaveBeenCalledWith({ path: "/mnt/workspace/docs/readme.md" });
  });

  it("normalizes paths outside virtual root before reading", async () => {
    mockSandboxReadFile.mockResolvedValue({
      path: "/mnt/workspace/output/report.md",
      content: "# Report"
    });

    // Path starts with "/" but lacks virtual root prefix
    await usePreviewStore.getState().openPreview("/output/report.md", "report.md");

    expect(mockSandboxReadFile).toHaveBeenCalledWith({
      path: "/mnt/workspace/output/report.md"
    });
    expect(usePreviewStore.getState().content).toBe("# Report");
  });

  it("sets error on read failure", async () => {
    mockSandboxReadFile.mockRejectedValue(new Error("File not found"));

    await usePreviewStore.getState().openPreview("/missing/file.txt", "file.txt");

    const state = usePreviewStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.content).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBe("File not found");
  });

  it("closes preview and resets state", async () => {
    mockSandboxReadFile.mockResolvedValue({
      path: "/docs/close-test.md",
      content: "# Hello"
    });

    await usePreviewStore.getState().openPreview("/docs/close-test.md", "close-test.md");
    usePreviewStore.getState().closePreview();

    const state = usePreviewStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.filePath).toBeNull();
    expect(state.content).toBeNull();
  });

  it("does not reload when same file is already open", async () => {
    mockSandboxReadFile.mockResolvedValue({
      path: "/docs/same.md",
      content: "# Same"
    });

    await usePreviewStore.getState().openPreview("/docs/same.md", "same.md");
    await usePreviewStore.getState().openPreview("/docs/same.md", "same.md");

    // Only one API call since the same file is already open
    expect(mockSandboxReadFile).toHaveBeenCalledTimes(1);
  });

  it("always re-fetches when opening the same file after close", async () => {
    mockSandboxReadFile.mockResolvedValue({
      path: "/docs/refetch.md",
      content: "# V1"
    });

    await usePreviewStore.getState().openPreview("/docs/refetch.md", "refetch.md");
    expect(mockSandboxReadFile).toHaveBeenCalledTimes(1);

    usePreviewStore.getState().closePreview();

    mockSandboxReadFile.mockResolvedValue({
      path: "/docs/refetch.md",
      content: "# V2"
    });

    await usePreviewStore.getState().openPreview("/docs/refetch.md", "refetch.md");

    // Should re-fetch (no stale cache)
    expect(mockSandboxReadFile).toHaveBeenCalledTimes(2);
    expect(usePreviewStore.getState().content).toBe("# V2");
  });

  it("passes workspacePath to sandboxReadFile when set", async () => {
    mockSandboxReadFile.mockResolvedValue({
      path: "/mnt/workspace/output/report.md",
      content: "# Report"
    });

    usePreviewStore.getState().setWorkspacePath("/home/user/.bandry/workspaces/task_abc123");
    await usePreviewStore.getState().openPreview("/mnt/workspace/output/report.md", "report.md");

    expect(mockSandboxReadFile).toHaveBeenCalledWith({
      path: "/mnt/workspace/output/report.md",
      workspacePath: "/home/user/.bandry/workspaces/task_abc123"
    });
  });

  it("prefers workspacePath override when provided", async () => {
    mockSandboxReadFile.mockResolvedValue({
      path: "/mnt/workspace/output/report.md",
      content: "# Report"
    });

    usePreviewStore.getState().setWorkspacePath("/home/user/.bandry/workspaces/task_latest");
    await usePreviewStore
      .getState()
      .openPreview("/mnt/workspace/output/report.md", "report.md", "/home/user/.bandry/workspaces/task_old");

    expect(mockSandboxReadFile).toHaveBeenCalledWith({
      path: "/mnt/workspace/output/report.md",
      workspacePath: "/home/user/.bandry/workspaces/task_old"
    });
  });

  it("does not pass workspacePath when not set", async () => {
    mockSandboxReadFile.mockResolvedValue({
      path: "/mnt/workspace/docs/readme.md",
      content: "# Hello"
    });

    await usePreviewStore.getState().openPreview("/docs/readme.md", "readme.md");

    expect(mockSandboxReadFile).toHaveBeenCalledWith({
      path: "/mnt/workspace/docs/readme.md"
    });
  });

  it("discards stale result when user switches files during loading", async () => {
    // First file: slow to resolve
    let resolveFirst: ((value: { path: string; content: string }) => void) | undefined;
    const firstPromise = new Promise<{ path: string; content: string }>((resolve) => {
      resolveFirst = resolve;
    });
    mockSandboxReadFile.mockReturnValueOnce(firstPromise);

    // Start loading first file (don't await — it's slow)
    const firstOpen = usePreviewStore.getState().openPreview("/docs/slow.md", "slow.md");

    // User switches to second file immediately
    mockSandboxReadFile.mockResolvedValueOnce({
      path: "/docs/fast.md",
      content: "# Fast"
    });
    await usePreviewStore.getState().openPreview("/docs/fast.md", "fast.md");

    // Second file should be showing
    expect(usePreviewStore.getState().filePath).toBe("/docs/fast.md");
    expect(usePreviewStore.getState().content).toBe("# Fast");

    // Now the slow first file resolves
    resolveFirst!({ path: "/docs/slow.md", content: "# Slow" });
    await firstOpen;

    // State should still show the second file (first result discarded)
    expect(usePreviewStore.getState().filePath).toBe("/docs/fast.md");
    expect(usePreviewStore.getState().content).toBe("# Fast");
  });
});
