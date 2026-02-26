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
 *   tool-executor observation → trace message → parseToolResult
 *   → extractFilePaths → openPreview → normalizeToVirtualPath → sandboxReadFile
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseToolResult, extractFilePaths } from "../../../features/copilot/trace-paths";
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

// ---------------------------------------------------------------------------
// Helpers that mirror the main-process output format
// ---------------------------------------------------------------------------

/**
 * Build a delegate_sub_tasks observation output identical to tool-executor.ts
 */
const buildDelegationOutput = (
  results: Array<{ taskId: string; success: boolean; error?: string }>,
  artifacts: string[]
): string => {
  const successCount = results.filter((r) => r.success).length;
  const lines = [
    `Delegation finished: ${successCount}/${results.length} succeeded.`,
    ...results.map((r) => `${r.taskId}: ${r.success ? "success" : "failed"}${r.error ? ` | error=${r.error}` : ""}`),
    ...(artifacts.length > 0 ? [`Artifacts: ${artifacts.join(", ")}`] : [])
  ];
  return lines.join("\n");
};

/**
 * Build a trace message identical to planner-chat-agent.ts line 382
 */
const buildTraceMessage = (tool: string, ok: boolean, output: string): string => {
  return `${tool} -> ${ok ? "success" : "failed"}: ${output}`;
};

/**
 * Simulate the full chain: trace message → parseToolResult → extractFilePaths.
 * Returns the paths exactly as the ToolResultLayer component would see them.
 */
const simulatePathExtraction = (traceMessage: string): { path: string; name: string }[] => {
  const parsed = parseToolResult(traceMessage);
  if (!parsed) return [];
  return extractFilePaths(parsed.output);
};

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
  // Case 1: Planner produces writePath = "/output/report.md"
  //         (absolute but missing virtual root — the original bug)
  // -------------------------------------------------------------------------
  it("normalizes artifact path with bare absolute prefix (/output/report.md)", async () => {
    const observation = buildDelegationOutput(
      [
        { taskId: "sub_1", success: true },
        { taskId: "sub_2", success: true }
      ],
      ["/output/report.md"]
    );
    const trace = buildTraceMessage("delegate_sub_tasks", true, observation);

    // --- extract ---
    const files = simulatePathExtraction(trace);
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
  // Case 2: Planner produces writePath = "/mnt/workspace/output/report.md"
  //         (already a correct virtual path — should pass through unchanged)
  // -------------------------------------------------------------------------
  it("passes through path that already has virtual root prefix", async () => {
    const observation = buildDelegationOutput(
      [{ taskId: "sub_1", success: true }],
      ["/mnt/workspace/output/report.md"]
    );
    const trace = buildTraceMessage("delegate_sub_tasks", true, observation);

    const files = simulatePathExtraction(trace);
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
    const observation = buildDelegationOutput(
      [
        { taskId: "research", success: true },
        { taskId: "writer", success: true }
      ],
      ["/staging/research.md", "/mnt/workspace/output/final-report.md"]
    );
    const trace = buildTraceMessage("delegate_sub_tasks", true, observation);

    const files = simulatePathExtraction(trace);
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
  // Case 4: Artifacts converted to virtual paths by tool-executor
  //         tool-executor.ts now converts relative artifact paths like
  //         "output/report.md" to "/mnt/workspace/output/report.md"
  //         before they appear in the output, so extractFilePaths captures
  //         the full correct path.
  // -------------------------------------------------------------------------
  it("handles artifacts pre-converted to virtual paths by tool-executor", async () => {
    const observation = buildDelegationOutput(
      [{ taskId: "sub_1", success: true }],
      ["/mnt/workspace/output/report.md", "/mnt/workspace/staging/research.md"]
    );
    const trace = buildTraceMessage("delegate_sub_tasks", true, observation);

    const files = simulatePathExtraction(trace);
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
    const observation = buildDelegationOutput(
      [{ taskId: "sub_1", success: true }],
      ["/output/docs/api/reference.md"]
    );
    const trace = buildTraceMessage("delegate_sub_tasks", true, observation);

    const files = simulatePathExtraction(trace);
    expect(files).toHaveLength(1);

    await usePreviewStore.getState().openPreview(files[0].path, files[0].name);

    const callArgs = mockSandboxReadFile.mock.calls[0][0] as Record<string, unknown>;
    assertAbsoluteVirtualPath(callArgs, VIRTUAL_ROOT);
    expect(callArgs.path).toBe("/mnt/workspace/output/docs/api/reference.md");
  });

  // -------------------------------------------------------------------------
  // Case 6: read_file tool output embedding a virtual path in its content
  //         (e.g. another file references /mnt/workspace/src/index.ts)
  // -------------------------------------------------------------------------
  it("extracts and preserves paths already inside virtual root from read_file output", async () => {
    const fileContent = 'import { foo } from "/mnt/workspace/src/utils.ts";';
    const trace = buildTraceMessage("read_file", true, fileContent);

    const files = simulatePathExtraction(trace);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("/mnt/workspace/src/utils.ts");

    await usePreviewStore.getState().openPreview(files[0].path, files[0].name);

    const callArgs = mockSandboxReadFile.mock.calls[0][0] as Record<string, unknown>;
    assertAbsoluteVirtualPath(callArgs, VIRTUAL_ROOT);
    expect(callArgs.path).toBe("/mnt/workspace/src/utils.ts");
  });

  // -------------------------------------------------------------------------
  // Case 7: Custom virtual root
  // -------------------------------------------------------------------------
  it("works with a custom virtual root", async () => {
    const customRoot = "/sandbox";
    usePreviewStore.getState().setVirtualRoot(customRoot);

    const observation = buildDelegationOutput(
      [{ taskId: "sub_1", success: true }],
      ["/output/report.md"]
    );
    const trace = buildTraceMessage("delegate_sub_tasks", true, observation);

    const files = simulatePathExtraction(trace);
    expect(files).toHaveLength(1);

    await usePreviewStore.getState().openPreview(files[0].path, files[0].name);

    const callArgs = mockSandboxReadFile.mock.calls[0][0] as Record<string, unknown>;
    assertAbsoluteVirtualPath(callArgs, customRoot);
    expect(callArgs.path).toBe("/sandbox/output/report.md");
  });

  // -------------------------------------------------------------------------
  // Case 8: workspacePath not set (e.g. re-opening old conversation)
  //         Path normalization should still work; workspacePath should be absent
  // -------------------------------------------------------------------------
  it("normalizes path even when workspacePath is null", async () => {
    usePreviewStore.setState({ workspacePath: null });

    const observation = buildDelegationOutput(
      [{ taskId: "sub_1", success: true }],
      ["/output/summary.md"]
    );
    const trace = buildTraceMessage("delegate_sub_tasks", true, observation);
    const files = simulatePathExtraction(trace);

    await usePreviewStore.getState().openPreview(files[0].path, files[0].name);

    const callArgs = mockSandboxReadFile.mock.calls[0][0] as Record<string, unknown>;
    assertAbsoluteVirtualPath(callArgs, VIRTUAL_ROOT);
    expect(callArgs.path).toBe("/mnt/workspace/output/summary.md");
    // workspacePath should NOT be present
    expect(callArgs).not.toHaveProperty("workspacePath");
  });

  // -------------------------------------------------------------------------
  // Case 9: Failed tool output with error containing a real filesystem path
  //         Should still normalize to virtual root (defense-in-depth)
  // -------------------------------------------------------------------------
  it("normalizes real filesystem paths from error output", async () => {
    const errorOutput = 'ENOENT: no such file or directory /tmp/bandry-staging/draft.md';
    const trace = buildTraceMessage("exec", false, errorOutput);

    const files = simulatePathExtraction(trace);
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("/tmp/bandry-staging/draft.md");

    await usePreviewStore.getState().openPreview(files[0].path, files[0].name);

    const callArgs = mockSandboxReadFile.mock.calls[0][0] as Record<string, unknown>;
    // Even a real path gets normalized into the virtual root
    assertAbsoluteVirtualPath(callArgs, VIRTUAL_ROOT);
    expect(callArgs.path).toBe("/mnt/workspace/tmp/bandry-staging/draft.md");
  });
});
