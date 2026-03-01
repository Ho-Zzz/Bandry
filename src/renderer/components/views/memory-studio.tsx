import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FolderTree,
  RefreshCw,
  Trash2,
  Upload,
  X,
  XCircle
} from "lucide-react";
import type {
  GlobalSettingsState,
  MemoryListResourceEntry,
  MemoryReadResourceResult,
  MemorySearchResultItem,
  MemoryStatusResult
} from "../../../shared/ipc";

const DEFAULT_ROOT_URIS = ["viking://resources", "viking://user", "viking://agent"];

const dedupeUris = (uris: string[]): string[] => {
  const normalized = uris.map((item) => item.trim().replace(/\/+$/, "")).filter(Boolean);
  const unique = Array.from(new Set(normalized));
  return unique.filter(
    (uri) => !unique.some((other) => other !== uri && uri.startsWith(`${other}/`))
  );
};

const scoreText = (value?: number): string => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  return value.toFixed(3);
};

export const MemoryStudio = () => {
  const [status, setStatus] = useState<MemoryStatusResult | null>(null);
  const [settings, setSettings] = useState<GlobalSettingsState | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchTargetUri, setSearchTargetUri] = useState("");
  const [searchLimit, setSearchLimit] = useState(6);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState<MemorySearchResultItem[]>([]);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPaths, setImportPaths] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const [dirEntriesMap, setDirEntriesMap] = useState<Record<string, MemoryListResourceEntry[]>>({});
  const [dirLoadingMap, setDirLoadingMap] = useState<Record<string, boolean>>({});
  const [dirErrorMap, setDirErrorMap] = useState<Record<string, string>>({});
  const [expandedDirUris, setExpandedDirUris] = useState<Record<string, boolean>>({});

  const [selectedDirUri, setSelectedDirUri] = useState("");
  const [selectedFileUri, setSelectedFileUri] = useState("");
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState("");
  const [doc, setDoc] = useState<MemoryReadResourceResult | null>(null);

  const [deleteConfirmUri, setDeleteConfirmUri] = useState<{ uri: string; isDir: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [localPathMap, setLocalPathMap] = useState<Record<string, string>>({});
  const [imageDataUrl, setImageDataUrl] = useState("");

  const rootUris = useMemo(() => {
    const fromSettings = settings?.memory.openviking.targetUris ?? [];
    return dedupeUris([...DEFAULT_ROOT_URIS, ...fromSettings]);
  }, [settings]);

  const loadStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      setStatusError("");
      const [nextStatus, nextSettings] = await Promise.all([
        window.api.memoryStatus(),
        window.api.getSettingsState()
      ]);
      setStatus(nextStatus);
      setSettings(nextSettings);
      setSearchLimit(Math.max(1, nextSettings.memory.openviking.memoryTopK || 6));
      if (!selectedDirUri) {
        setSelectedDirUri(nextSettings.memory.openviking.targetUris[0] || DEFAULT_ROOT_URIS[0]);
      }
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Failed to load memory status");
    } finally {
      setStatusLoading(false);
    }
  }, [selectedDirUri]);

  const loadDirectory = useCallback(async (uri: string) => {
    const normalizedUri = uri.trim();
    if (!normalizedUri) {
      return;
    }
    try {
      setDirLoadingMap((previous) => ({ ...previous, [normalizedUri]: true }));
      setDirErrorMap((previous) => ({ ...previous, [normalizedUri]: "" }));
      const result = await window.api.memoryListResources({ uri: normalizedUri });
      setDirEntriesMap((previous) => ({
        ...previous,
        [normalizedUri]: result.entries
      }));
    } catch (error) {
      setDirErrorMap((previous) => ({
        ...previous,
        [normalizedUri]: error instanceof Error ? error.message : "Failed to list resources"
      }));
      setDirEntriesMap((previous) => ({
        ...previous,
        [normalizedUri]: []
      }));
    } finally {
      setDirLoadingMap((previous) => ({ ...previous, [normalizedUri]: false }));
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!status?.running) {
      return;
    }
    for (const rootUri of rootUris) {
      if (!dirEntriesMap[rootUri] && !dirLoadingMap[rootUri]) {
        void loadDirectory(rootUri);
        setExpandedDirUris((previous) => ({ ...previous, [rootUri]: true }));
      }
    }
  }, [dirEntriesMap, dirLoadingMap, loadDirectory, rootUris, status?.running]);

  useEffect(() => {
    if (!status?.running || !selectedDirUri) {
      return;
    }
    if (!dirEntriesMap[selectedDirUri] && !dirLoadingMap[selectedDirUri]) {
      void loadDirectory(selectedDirUri);
    }
  }, [dirEntriesMap, dirLoadingMap, loadDirectory, selectedDirUri, status?.running]);

  const openDirectory = useCallback((uri: string) => {
    setSelectedDirUri(uri);
    setExpandedDirUris((previous) => ({ ...previous, [uri]: true }));
    void loadDirectory(uri);
  }, [loadDirectory]);

  const toggleDirectory = useCallback((uri: string) => {
    setExpandedDirUris((previous) => ({ ...previous, [uri]: !previous[uri] }));
    if (!dirEntriesMap[uri] && !dirLoadingMap[uri]) {
      void loadDirectory(uri);
    }
  }, [dirEntriesMap, dirLoadingMap, loadDirectory]);

  const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
  const BINARY_EXTENSIONS = new Set(["mp4", "mov", "avi", "mp3", "wav", "m4a"]);

  const loadDocument = useCallback(async (uri: string) => {
    try {
      setDocLoading(true);
      setDocError("");
      setSelectedFileUri(uri);
      setImageDataUrl("");

      const ext = uri.split(".").pop()?.toLowerCase() ?? "";

      if (IMAGE_EXTENSIONS.has(ext)) {
        const uriName = uri.split("/").pop()?.toLowerCase() ?? "";
        const localPath = localPathMap[uri]
          ?? localPathMap[uri.replace(/\/+$/, "")]
          ?? localPathMap[`__name__${uriName}`];
        if (localPath) {
          const result = await window.api.readFileBase64({ path: localPath });
          setImageDataUrl(`data:${result.mimeType};base64,${result.base64}`);
          setDoc(null);
        } else {
          setDoc({ uri, content: `[图片文件] .${ext} 格式，原始文件路径不可用（仅当前导入会话内可预览）。\n\n资源已导入 OpenViking，可通过语义检索命中。` });
        }
        return;
      }

      if (BINARY_EXTENSIONS.has(ext)) {
        setDoc({ uri, content: `[二进制文件] 此文件为 .${ext} 格式，无法以文本形式预览。\n\n资源已导入 OpenViking，可通过语义检索命中。` });
        return;
      }

      const next = await window.api.memoryReadResource({ uri });
      setDoc(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "文档读取失败";
      if (message.includes("is a directory")) {
        setDocError("");
        setDoc(null);
        openDirectory(uri);
        return;
      }
      if (message.includes("utf-8") || message.includes("codec can't decode")) {
        setDoc({ uri, content: "[二进制文件] 此文件包含非文本内容，无法预览。\n\n资源已导入 OpenViking，可通过语义检索命中。" });
        setDocError("");
        return;
      }
      setDocError(message);
      setDoc(null);
    } finally {
      setDocLoading(false);
    }
  }, [openDirectory, localPathMap]);

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchError("请输入检索 query");
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      setSearchError("");
      const result = await window.api.memorySearch({
        query,
        targetUri: searchTargetUri.trim() || undefined,
        limit: Math.max(1, searchLimit)
      });
      setSearchResults(result.items);
      setSearchModalOpen(true);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "检索失败");
      setSearchResults([]);
      setSearchModalOpen(true);
    } finally {
      setSearchLoading(false);
    }
  };

  const IMPORT_FILE_FILTERS = [
    { name: "支持的文件", extensions: ["pdf", "md", "txt", "json", "png", "jpg", "jpeg"] }
  ];

  const handleSelectFiles = async () => {
    const paths = await window.api.dialogOpenFiles(IMPORT_FILE_FILTERS);
    if (paths.length > 0) {
      setImportPaths((previous) => dedupeUris([...previous, ...paths]));
      setImportMessage("");
    }
  };

  const handleImport = async () => {
    if (importPaths.length === 0) {
      setImportMessage("请先选择需要导入的文件。");
      return;
    }

    try {
      setImporting(true);
      setImportMessage("");

      const results = await Promise.allSettled(
        importPaths.map(async (path) => {
          const item = await window.api.memoryAddResource({ path });
          return { path, rootUri: item.rootUri };
        })
      );

      const success = results
        .filter((item): item is PromiseFulfilledResult<{ path: string; rootUri: string }> => item.status === "fulfilled")
        .map((item) => item.value);
      const failed = results
        .filter((item): item is PromiseRejectedResult => item.status === "rejected")
        .map((item) => item.reason);

      const summary = `导入完成：成功 ${success.length}，失败 ${failed.length}`;
      const firstRoot = success[0]?.rootUri;
      setImportMessage(firstRoot ? `${summary}（rootUri: ${firstRoot}）` : summary);

      const newPathMap: Record<string, string> = {};
      for (const item of success) {
        newPathMap[item.rootUri] = item.path;
        const bare = item.rootUri.replace(/\/+$/, "");
        newPathMap[bare] = item.path;
        const basename = item.path.split("/").pop() ?? item.path.split("\\").pop() ?? "";
        if (basename) {
          newPathMap[`__name__${basename.toLowerCase()}`] = item.path;
        }
      }
      setLocalPathMap((previous) => ({ ...previous, ...newPathMap }));

      setImportPaths([]);
      const refreshUris = new Set(rootUris);
      refreshUris.add("viking://resources");
      for (const uri of refreshUris) {
        await loadDirectory(uri);
      }
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteResource = async () => {
    if (!deleteConfirmUri) return;
    try {
      setDeleting(true);
      await window.api.memoryDeleteResource({
        uri: deleteConfirmUri.uri,
        recursive: deleteConfirmUri.isDir
      });
      if (selectedFileUri === deleteConfirmUri.uri) {
        setSelectedFileUri("");
        setDoc(null);
        setDocError("");
      }

      // Find parent directories that list the deleted entry, then refresh them
      const parentDirUris: string[] = [];
      for (const [dirUri, entries] of Object.entries(dirEntriesMap)) {
        if (entries.some((e) => e.uri === deleteConfirmUri.uri)) {
          parentDirUris.push(dirUri);
        }
      }

      // Clean up dirEntriesMap for deleted directories
      if (deleteConfirmUri.isDir) {
        setDirEntriesMap((previous) => {
          const next = { ...previous };
          for (const key of Object.keys(next)) {
            if (key === deleteConfirmUri.uri || key.startsWith(deleteConfirmUri.uri + "/") || key.startsWith(deleteConfirmUri.uri.replace(/\/$/, "") + "/")) {
              delete next[key];
            }
          }
          const bare = deleteConfirmUri.uri.replace(/\/$/, "");
          delete next[bare];
          delete next[bare + "/"];
          return next;
        });
        setExpandedDirUris((previous) => {
          const next = { ...previous };
          delete next[deleteConfirmUri.uri];
          delete next[deleteConfirmUri.uri.replace(/\/$/, "")];
          return next;
        });
      }

      for (const uri of parentDirUris) {
        await loadDirectory(uri);
      }

      // Fallback: if no parent was found in the map, refresh matching root URIs
      if (parentDirUris.length === 0) {
        for (const uri of rootUris) {
          if (deleteConfirmUri.uri.startsWith(uri)) {
            await loadDirectory(uri);
          }
        }
      }
    } catch (error) {
      setDocError(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeleting(false);
      setDeleteConfirmUri(null);
    }
  };

  const isResourceUri = (uri: string): boolean => uri.startsWith("viking://resources");

  const renderTreeDir = (uri: string, label: string, level: number) => {
    const entries = dirEntriesMap[uri] ?? [];
    const expanded = expandedDirUris[uri] ?? false;
    const loading = dirLoadingMap[uri] ?? false;
    const error = dirErrorMap[uri] ?? "";
    const childDirs = entries.filter((entry) => entry.type === "directory");
    const childFiles = entries.filter((entry) => entry.type === "file");

    return (
      <div key={uri}>
        <button
          type="button"
          onClick={() => {
            openDirectory(uri);
          }}
          className={`group flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm ${
            selectedDirUri === uri ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-100"
          }`}
          style={{ paddingLeft: `${8 + level * 16}px` }}
        >
          <span
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded hover:bg-slate-200"
            onClick={(event) => {
              event.stopPropagation();
              toggleDirectory(uri);
            }}
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          <span className="truncate">📁 {label}</span>
          {isResourceUri(uri) && level > 0 ? (
            <span
              className="ml-auto shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-600"
              onClick={(event) => {
                event.stopPropagation();
                setDeleteConfirmUri({ uri, isDir: true });
              }}
            >
              <Trash2 size={12} />
            </span>
          ) : null}
        </button>

        {expanded ? (
          <div>
            {loading ? (
              <div className="px-3 py-1 text-xs text-slate-500" style={{ paddingLeft: `${28 + level * 16}px` }}>
                加载中...
              </div>
            ) : null}
            {error ? (
              <div className="px-3 py-1 text-xs text-rose-600" style={{ paddingLeft: `${28 + level * 16}px` }}>
                {error}
              </div>
            ) : null}
            {childDirs.map((entry) =>
              renderTreeDir(entry.uri, entry.name, level + 1)
            )}
            {childFiles.map((entry) => (
              <button
                key={entry.uri}
                type="button"
                onClick={() => {
                  setSelectedDirUri(uri);
                  void loadDocument(entry.uri);
                }}
                className={`group flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm ${
                  selectedFileUri === entry.uri
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                style={{ paddingLeft: `${28 + level * 16}px` }}
              >
                <span className="truncate">📄 {entry.name}</span>
                {isResourceUri(entry.uri) ? (
                  <span
                    className="ml-auto shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-600"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteConfirmUri({ uri: entry.uri, isDir: false });
                    }}
                  >
                    <Trash2 size={12} />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-full w-full bg-[linear-gradient(160deg,#f8fafc_0%,#eef2ff_45%,#f1f5f9_100%)]">
      <div className="mx-auto max-w-[1280px] space-y-6 p-6 md:p-8">
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">OpenViking Memory 管理</h1>
              </div>
              {!statusLoading && status ? (
                <button
                  type="button"
                  onClick={() => {
                    void loadStatus();
                  }}
                  disabled={statusLoading}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    status.running
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  {status.running ? (
                    <CheckCircle2 size={12} className="text-emerald-600" />
                  ) : (
                    <XCircle size={12} className="text-amber-600" />
                  )}
                  {status.running ? "运行中" : "未运行"}
                  <RefreshCw size={10} className={statusLoading ? "animate-spin" : ""} />
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {!statusLoading && status ? (
                <button
                  type="button"
                  onClick={() => {
                    setImportModalOpen(true);
                    setImportMessage("");
                  }}
                  disabled={!status.running}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                >
                  <Upload size={12} />
                  导入资源
                </button>
              ) : null}
            </div>
          </div>

          {statusError ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {statusError}
            </div>
          ) : null}

          {!statusLoading && status?.running ? (
            <div className="mt-4 flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500">检索语句</label>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="输入语义检索内容"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500">目标 URI（可选）</label>
                <input
                  value={searchTargetUri}
                  onChange={(event) => setSearchTargetUri(event.target.value)}
                  placeholder="viking://user/memories"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div className="w-20 shrink-0">
                <label className="mb-1 block text-xs font-medium text-slate-500">数量</label>
                <input
                  value={String(searchLimit)}
                  onChange={(event) => setSearchLimit(Number(event.target.value) || 1)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleSearch();
                }}
                disabled={searchLoading}
                className="shrink-0 rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {searchLoading ? "检索中..." : "搜索"}
              </button>
            </div>
          ) : null}

          {searchError ? (
            <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {searchError}
            </div>
          ) : null}
        </section>

        {!statusLoading && status && !status.running ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex items-start gap-2">
              <Brain size={18} className="mt-0.5 text-amber-700" />
              <div>
                <h2 className="text-sm font-semibold text-amber-900">OpenViking 当前未运行</h2>
                <p className="mt-1 text-sm text-amber-800">
                  请前往 Settings 启用 Memory Middleware 并检查 OpenViking 的 VLM/Embedding 模型绑定后，再返回此页操作。
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <aside className="xl:col-span-4">
              <div className="mb-3 flex items-center gap-2">
                <FolderTree size={16} className="text-indigo-600" />
                <h2 className="text-lg font-semibold text-slate-900">树形目录</h2>
              </div>
              <div className="max-h-[680px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                {rootUris.map((uri) => renderTreeDir(uri, uri, 0))}
              </div>
            </aside>

            <div className="xl:col-span-8">
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-slate-900">文档预览</h2>
                <p className="text-xs text-slate-500">在左侧树形目录中点击文件，右侧展示文档内容。</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                  <div className="text-sm font-medium text-slate-800">
                    {selectedFileUri ? selectedFileUri.split("/").pop() : "未选择文件"}
                  </div>
                  <div className="max-w-[50%] truncate text-xs text-slate-400">{selectedFileUri || ""}</div>
                </div>
                <div className="max-h-[640px] overflow-auto p-4">
                  {docLoading ? (
                    <div className="py-12 text-center text-sm text-slate-500">文档加载中...</div>
                  ) : docError ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{docError}</div>
                  ) : imageDataUrl ? (
                    <div className="flex items-center justify-center">
                      <img
                        src={imageDataUrl}
                        alt={selectedFileUri.split("/").pop() ?? "image"}
                        className="max-h-[600px] max-w-full rounded-lg object-contain"
                      />
                    </div>
                  ) : doc ? (
                    <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">{doc.content}</pre>
                  ) : (
                    <div className="py-20 text-center text-sm text-slate-400">在左侧目录树中点击文件以预览内容</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {importModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">导入资源</h3>
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p>将本地文件导入到 OpenViking 记忆系统。导入后文件会被自动向量化、生成摘要，并可通过语义检索命中。</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["pdf", "md", "txt", "json", "png", "jpg", "jpeg"].map((ext) => (
                    <span key={ext} className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-mono text-slate-600">.{ext}</span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    void handleSelectFiles();
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Upload size={14} />
                  选择本地文件（支持多选）
                </button>
              </div>

              <div className="mt-4 max-h-[180px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                {importPaths.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400">尚未选择文件</div>
                ) : (
                  <div className="space-y-1">
                    {importPaths.map((filePath) => (
                      <div key={filePath} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs">
                        <span className="min-w-0 truncate text-slate-700">{filePath}</span>
                        <button
                          type="button"
                          onClick={() => setImportPaths((previous) => previous.filter((item) => item !== filePath))}
                          className="ml-2 shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {importMessage ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  {importMessage}
                </div>
              ) : null}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleImport();
                  }}
                  disabled={importing || importPaths.length === 0}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {importing ? "导入中..." : `确认导入${importPaths.length > 0 ? `（${importPaths.length} 个文件）` : ""}`}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {deleteConfirmUri ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <h3 className="text-lg font-semibold text-slate-900">确认删除</h3>
              <p className="mt-2 text-sm text-slate-600">
                确定要删除{deleteConfirmUri.isDir ? "目录" : "文件"}{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{deleteConfirmUri.uri}</code>{" "}
                吗？{deleteConfirmUri.isDir ? "目录下所有内容将被递归删除。" : ""}此操作不可撤销。
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmUri(null)}
                  disabled={deleting}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleDeleteResource();
                  }}
                  disabled={deleting}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {deleting ? "删除中..." : "确认删除"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {searchModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
            <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">语义检索结果</h3>
                <button
                  type="button"
                  onClick={() => setSearchModalOpen(false)}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[520px] space-y-2 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
                    未命中结果
                  </div>
                ) : (
                  searchResults.map((item) => (
                    <article key={`${item.uri}-${item.score ?? "na"}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{item.uri}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.category || "-"} · score: {scoreText(item.score)}
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{item.abstract || "(no abstract)"}</p>
                    </article>
                  ))
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSearchModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
