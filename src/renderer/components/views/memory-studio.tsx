import { type ChangeEvent, type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FolderTree,
  RefreshCw,
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

const DEFAULT_ROOT_URIS = ["viking://user", "viking://agent"];

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

const getFilePathFromFileLike = (file: File): string | null => {
  const value = file as File & { path?: string };
  if (typeof value.path === "string" && value.path.trim()) {
    return value.path.trim();
  }
  return null;
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
  const [manualImportPath, setManualImportPath] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [dirEntriesMap, setDirEntriesMap] = useState<Record<string, MemoryListResourceEntry[]>>({});
  const [dirLoadingMap, setDirLoadingMap] = useState<Record<string, boolean>>({});
  const [dirErrorMap, setDirErrorMap] = useState<Record<string, string>>({});
  const [expandedDirUris, setExpandedDirUris] = useState<Record<string, boolean>>({});

  const [selectedDirUri, setSelectedDirUri] = useState("");
  const [selectedFileUri, setSelectedFileUri] = useState("");
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState("");
  const [doc, setDoc] = useState<MemoryReadResourceResult | null>(null);

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

  const loadDocument = useCallback(async (uri: string) => {
    try {
      setDocLoading(true);
      setDocError("");
      setSelectedFileUri(uri);
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
      setDocError(message);
      setDoc(null);
    } finally {
      setDocLoading(false);
    }
  }, [openDirectory]);

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

  const appendImportPaths = (paths: string[]) => {
    setImportPaths((previous) => dedupeUris([...previous, ...paths]));
  };

  const handleDropFiles = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dropped = Array.from(event.dataTransfer.files);
    const paths = dropped
      .map((file) => getFilePathFromFileLike(file))
      .filter((item): item is string => Boolean(item));
    if (paths.length > 0) {
      appendImportPaths(paths);
      setImportMessage("");
      return;
    }
    setImportMessage("未获取到可用本地路径，请使用手动输入或选择文件。");
  };

  const handlePickFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const paths = files
      .map((file) => getFilePathFromFileLike(file))
      .filter((item): item is string => Boolean(item));
    if (paths.length > 0) {
      appendImportPaths(paths);
      setImportMessage("");
    } else {
      setImportMessage("当前环境未提供文件绝对路径，请改用手动输入路径。");
    }
    event.target.value = "";
  };

  const handleImport = async () => {
    const manual = manualImportPath.trim();
    const finalPaths = dedupeUris([...importPaths, ...(manual ? [manual] : [])]);
    if (finalPaths.length === 0) {
      setImportMessage("请先拖拽/选择文件，或手动输入路径。");
      return;
    }

    try {
      setImporting(true);
      setImportMessage("");

      const results = await Promise.allSettled(
        finalPaths.map(async (path) => {
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
      setImportMessage(firstRoot ? `${summary}（示例 rootUri: ${firstRoot}）` : summary);

      setImportPaths([]);
      setManualImportPath("");
      for (const uri of rootUris) {
        await loadDirectory(uri);
      }
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

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
          className={`flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm ${
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
                className={`flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm ${
                  selectedFileUri === entry.uri
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                style={{ paddingLeft: `${28 + level * 16}px` }}
              >
                <span className="truncate">📄 {entry.name}</span>
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
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">导入资源</h3>
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
              <div
                className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center"
                onDrop={handleDropFiles}
                onDragOver={(event) => event.preventDefault()}
              >
                <Upload size={24} className="mx-auto text-slate-500" />
                <p className="mt-2 text-sm text-slate-700">拖拽本地文件到此处</p>
                <p className="text-xs text-slate-500">也可点击下方按钮选择文件（支持多选）</p>
                <button
                  type="button"
                  className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
                  onClick={() => fileInputRef.current?.click()}
                >
                  选择本地文件
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handlePickFiles}
                />
              </div>
              <div className="mt-3">
                <div className="mb-1 text-xs text-slate-500">手动输入路径 / URL（可选）</div>
                <input
                  value={manualImportPath}
                  onChange={(event) => setManualImportPath(event.target.value)}
                  placeholder="/Users/me/doc.md 或 https://example.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-3 max-h-[140px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                {importPaths.length === 0 ? (
                  <div className="text-xs text-slate-500">尚未添加拖拽/选择的文件</div>
                ) : (
                  <div className="space-y-1">
                    {importPaths.map((path) => (
                      <div key={path} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                        <span className="truncate">{path}</span>
                        <button
                          type="button"
                          onClick={() => setImportPaths((previous) => previous.filter((item) => item !== path))}
                          className="ml-2 rounded p-0.5 text-slate-500 hover:bg-slate-100"
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
                  disabled={importing}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {importing ? "导入中..." : "确认导入"}
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
