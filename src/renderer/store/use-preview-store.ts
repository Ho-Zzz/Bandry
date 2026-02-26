/**
 * Preview Panel Store
 *
 * Zustand store for managing the file preview panel state.
 * Handles opening/closing the panel and loading file content via sandbox IPC.
 */

import { create } from "zustand";

const DEFAULT_VIRTUAL_ROOT = "/mnt/workspace";

/**
 * Normalize a file path so it lives inside the virtual root.
 * Paths extracted from tool output may start with "/" but lack the virtual-root
 * prefix (e.g. "/output/report.md"), which causes the sandbox path guard to
 * reject them with "Path escapes virtual root".
 */
const normalizeToVirtualPath = (filePath: string, virtualRoot: string): string => {
  const vr = virtualRoot.replace(/\/+$/, "") || DEFAULT_VIRTUAL_ROOT;
  if (filePath === vr || filePath.startsWith(`${vr}/`)) {
    return filePath;
  }
  const relative = filePath.startsWith("/") ? filePath.slice(1) : filePath;
  return `${vr}/${relative}`;
};

interface PreviewState {
  isOpen: boolean;
  filePath: string | null;
  fileName: string | null;
  content: string | null;
  loading: boolean;
  error: string | null;
  workspacePath: string | null;
  virtualRoot: string;

  setWorkspacePath: (path: string | null) => void;
  setVirtualRoot: (root: string) => void;
  openPreview: (filePath: string, fileName: string) => Promise<void>;
  closePreview: () => void;
}

export const usePreviewStore = create<PreviewState>()((set, get) => ({
  isOpen: false,
  filePath: null,
  fileName: null,
  content: null,
  loading: false,
  error: null,
  workspacePath: null,
  virtualRoot: DEFAULT_VIRTUAL_ROOT,

  setWorkspacePath: (path: string | null) => {
    set({ workspacePath: path });
  },

  setVirtualRoot: (root: string) => {
    set({ virtualRoot: root || DEFAULT_VIRTUAL_ROOT });
  },

  openPreview: async (filePath: string, fileName: string) => {
    const current = get();
    if (current.filePath === filePath && current.isOpen) {
      return;
    }

    set({
      isOpen: true,
      filePath,
      fileName,
      content: null,
      loading: true,
      error: null
    });

    try {
      const { workspacePath: currentWorkspace, virtualRoot } = get();
      const normalizedPath = normalizeToVirtualPath(filePath, virtualRoot);
      const result = await window.api.sandboxReadFile({
        path: normalizedPath,
        ...(currentWorkspace ? { workspacePath: currentWorkspace } : {})
      });
      // Guard against race: if user switched to a different file while loading,
      // discard this result to avoid mismatched content.
      if (get().filePath !== filePath) {
        return;
      }
      set({ content: result.content, loading: false });
    } catch (err) {
      if (get().filePath !== filePath) {
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to read file";
      set({ error: message, loading: false });
    }
  },

  closePreview: () => {
    set({
      isOpen: false,
      filePath: null,
      fileName: null,
      content: null,
      loading: false,
      error: null
    });
  }
}));
