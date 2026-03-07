/**
 * Workspace Document Preview Integration Test
 *
 * Simulates the full flow from chat generating workspace documents
 * to clicking file links in the UI and opening them in the preview panel.
 *
 * Ensures that no matter what path format the tool output produces,
 * the final sandboxReadFile call always receives an absolute virtual path
 * (i.e. prefixed with the virtual root, e.g. /mnt/workspace/...).
 *
 * Chain under test:
 *   structured artifacts → openPreview → normalizeToVirtualPath → sandboxReadFile
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { usePreviewStore } from "../../../store/use-preview-store";

// ---------------------------------------------------------------------------
// Mock window.api
// ---------------------------------------------------------------------------
const mockSandboxReadFile = vi.fn();

vi.stubGlobal("window", {
  api: {
    sandboxReadFile: mockSandboxReadFile
  }
});

const asFileEntries = (paths: string[]): { path: string; name: string }[] =>
  paths.map((entryPath) => ({
    path: entryPath,
    name: entryPath.split("/").pop() ?? entryPath
  }));

/**
 * Assert that a given sandboxReadFile call used a path that is a proper
 * absolute virtual path (starts with virtualRoot + "/").
 */
const assertAbsoluteVirtualPath = (callArgs: Record<string, unknown>, virtualRoot: string): void => {
  const actualPath = callArgs.path as string;
  expect(actualPath).toBeDefined();
  expect(
    actualPath.startsWith(`${virtualRoot}/`),
    `Expected path to start with "${virtualRoot}/", got "${actualPath}"`
  ).toBe(true);
  // Must not contain "/../" (no traversal)
  expect(actualPath).not.toContain("/../");
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Workspace document preview — full chain", () => {
  const VIRTUAL_ROOT = "/mnt/workspace";
  const WORKSPACE_PATH = "/Users/test/.bandry/workspaces/task_e2e001";

  beforeEach(() => {
    usePreviewStore.setState({
      isOpen: false,
      filePath: null,
      fileName: null,
      content: null,
      loading: false,
      error: null,
      workspacePath: WORKSPACE_PATH,
      virtualRoot: VIRTUAL_ROOT
    });
    mockSandboxReadFile.mockReset();
    mockSandboxReadFile.mockResolvedValue({ path: "", content: "# mock" });
  });

  // -------------------------------------------------------------------------
  // Case 1: planner/tool returns a relative artifact-like path without root prefix
  // -------------------------------------------------------------------------
  it("normalizes artifact path with bare absolute prefix (/output/report.md)", async () => {
    const files = asFileEntries(["/output/report.md"]);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("/output/report.md");
    expect(files[0].name).toBe("report.md");

    // --- click to open ---
    await usePreviewStore.getState().openPreview(files[0].path, files[0].name);

    // --- verify sandboxReadFile receives absolute virtual path ---
    expect(mockSandboxReadFile).toHaveBeenCalledTimes(1);
    const callArgs = mockSandboxReadFile.mock.calls[0][0] as Record<string, unknown>;
    assertAbsoluteVirtualPath(callArgs, VIRTUAL_ROOT);
    expect(callArgs.path).toBe("/mnt/workspace/output/report.md");
    expect(callArgs.workspacePath).toBe(WORKSPACE_PATH);
  });

  // -------------------------------------------------------------------------
  // Case 2: Already normalized virtual path should pass through unchanged.
  // -------------------------------------------------------------------------
  it("passes through path that already has virtual root prefix", async () => {
    const files = asFileEntries(["/mnt/workspace/output/report.md"]);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("/mnt/workspace/output/report.md");

    await usePreviewStore.getState().openPreview(files[0].path, files[0].name);

    expect(mockSandboxReadFile).toHaveBeenCalledTimes(1);
    const callArgs = mockSandboxReadFile.mock.calls[0][0] as Record<string, unknown>;
    assertAbsoluteVirtualPath(callArgs, VIRTUAL_ROOT);
    expect(callArgs.path).toBe("/mnt/workspace/output/report.md");
  });

  // -------------------------------------------------------------------------
  // Case 3: Multiple artifacts, mixed path formats
  // -------------------------------------------------------------------------
  it("handles multiple artifacts with mixed path formats", async () => {
    const files = asFileEntries(["/staging/research.md", "/mnt/workspace/output/final-report.md"]);
    expect(files).toHaveLength(2);

    for (const file of files) {
      mockSandboxReadFile.mockResolvedValueOnce({ path: "", content: `# ${file.name}` });
      // Reset isOpen so openPreview triggers for each file
      usePreviewStore.getState().closePreview();
      await usePreviewStore.getState().openPreview(file.path, file.name);
    }

    // Every call must use an absolute virtual path
    for (const call of mockSandboxReadFile.mock.calls) {
      const args = call[0] as Record<string, unknown>;
      assertAbsoluteVirtualPath(args, VIRTUAL_ROOT);
    }

    const paths = mockSandboxReadFile.mock.calls.map((c) => (c[0] as Record<string, unknown>).path);
    expect(paths).toContain("/mnt/workspace/staging/research.md");
    expect(paths).toContain("/mnt/workspace/output/final-report.md");
  });

  // -------------------------------------------------------------------------
  // Case 4: Artifacts already pre-converted to virtual paths by backend.
  // -------------------------------------------------------------------------
  it("handles artifacts pre-converted to virtual paths by tool-executor", async () => {
    const files = asFileEntries(["/mnt/workspace/output/report.md", "/mnt/workspace/staging/research.md"]);
    expect(files).toHaveLength(2);
    expect(files[0].path).toBe("/mnt/workspace/output/report.md");
    expect(files[1].path).toBe("/mnt/workspace/staging/research.md");

    for (const file of files) {
      mockSandboxReadFile.mockResolvedValueOnce({ path: "", content: `# ${file.name}` });
      usePreviewStore.getState().closePreview();
      await usePreviewStore.getState().openPreview(file.path, file.name);
    }

    // Every call must use an absolute virtual path with full directory structure
    for (const call of mockSandboxReadFile.mock.calls) {
      const args = call[0] as Record<string, unknown>;
      assertAbsoluteVirtualPath(args, VIRTUAL_ROOT);
    }
    const paths = mockSandboxReadFile.mock.calls.map((c) => (c[0] as Record<string, unknown>).path);
    expect(paths).toContain("/mnt/workspace/output/report.md");
    expect(paths).toContain("/mnt/workspace/staging/research.md");
  });

  // -------------------------------------------------------------------------
  // Case 5: Deep nested path with bare absolute prefix
  // -------------------------------------------------------------------------
  it("normalizes deep nested artifact path (/output/docs/api/reference.md)", async () => {
    const files = asFileEntries(["/output/docs/api/reference.md"]);
    expect(files).toHaveLength(1);

    await usePreviewStore.getState().openPreview(files[0].path, files[0].name);

    const callArgs = mockSandboxReadFile.mock.calls[0][0] as Record<string, unknown>;
    assertAbsoluteVirtualPath(callArgs, VIRTUAL_ROOT);
    expect(callArgs.path).toBe("/mnt/workspace/output/docs/api/reference.md");
  });

  // -------------------------------------------------------------------------
  // Case 6: Custom virtual root
  // -------------------------------------------------------------------------
  it("works with a custom virtual root", async () => {
    const customRoot = "/sandbox";
    usePreviewStore.getState().setVirtualRoot(customRoot);

    const files = asFileEntries(["/output/report.md"]);
    expect(files).toHaveLength(1);

    await usePreviewStore.getState().openPreview(files[0].path, files[0].name);

    const callArgs = mockSandboxReadFile.mock.calls[0][0] as Record<string, unknown>;
    assertAbsoluteVirtualPath(callArgs, customRoot);
    expect(callArgs.path).toBe("/sandbox/output/report.md");
  });

  // -------------------------------------------------------------------------
  // Case 7: workspacePath not set (e.g. re-opening old conversation)
  //         Path normalization should still work; workspacePath should be absent
  // -------------------------------------------------------------------------
  it("normalizes path even when workspacePath is null", async () => {
    usePreviewStore.setState({ workspacePath: null });

    const files = asFileEntries(["/output/summary.md"]);

    await usePreviewStore.getState().openPreview(files[0].path, files[0].name);

    const callArgs = mockSandboxReadFile.mock.calls[0][0] as Record<string, unknown>;
    assertAbsoluteVirtualPath(callArgs, VIRTUAL_ROOT);
    expect(callArgs.path).toBe("/mnt/workspace/output/summary.md");
    // workspacePath should NOT be present
    expect(callArgs).not.toHaveProperty("workspacePath");
  });

});
