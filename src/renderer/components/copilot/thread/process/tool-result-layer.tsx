import { GlobeIcon, WrenchIcon } from "lucide-react";

import { extractFilePaths } from "../../../../features/copilot/trace-paths";
import { usePreviewStore } from "../../../../store/use-preview-store";
import { type ToolResultSummary } from "./trace-utils";

type ToolResultLayerProps = {
  summaries: ToolResultSummary[];
};

const statusMeta = (status: ToolResultSummary["status"]): { label: string; className: string; dotClassName: string } => {
  if (status === "success") {
    return {
      label: "成功",
      className: "text-emerald-700",
      dotClassName: "bg-emerald-500"
    };
  }

  if (status === "failed") {
    return {
      label: "失败",
      className: "text-rose-700",
      dotClassName: "bg-rose-500"
    };
  }

  return {
    label: "执行中",
    className: "text-amber-700",
    dotClassName: "bg-amber-500 animate-pulse"
  };
};

const isSearchTool = (source: string): boolean => {
  const normalized = source.toLowerCase();
  return normalized.includes("search") || normalized.includes("web") || normalized.includes("browse");
};

export const ToolResultLayer = ({ summaries }: ToolResultLayerProps) => {
  const openPreview = usePreviewStore((s) => s.openPreview);

  if (summaries.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-xs font-medium text-zinc-500">Artifacts & Tool Output</p>

      {summaries.map((summary, index) => {
        const filePaths = extractFilePaths(summary.output);
        const meta = statusMeta(summary.status);
        const searchLike = isSearchTool(summary.source);

        return (
          <div key={`${summary.source}-${summary.timestamp ?? index}`} className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
            {searchLike ? <GlobeIcon size={12} className="text-zinc-400" /> : <WrenchIcon size={12} className="text-zinc-400" />}

            {searchLike ? <span>搜索了</span> : <span>调用了 {summary.source}</span>}

            {summary.sources.length > 0
              ? summary.sources.map((source, sourceIndex) => (
                  <span key={source.id} className="inline-flex items-center">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 items-center rounded-md px-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                    >
                      {source.title}
                    </a>
                    {sourceIndex < summary.sources.length - 1 ? <span className="px-0.5">、</span> : null}
                  </span>
                ))
              : null}

            {filePaths.length > 0 ? (
              <span className="inline-flex items-center gap-1">
                <span>产出</span>
                {filePaths.map((fileInfo, fileIndex) => (
                  <span key={fileInfo.path} className="inline-flex items-center">
                    <button
                      type="button"
                      className="inline-flex h-7 items-center rounded-md px-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                      onClick={() => {
                        void openPreview(fileInfo.path, fileInfo.name, summary.workspacePath);
                      }}
                    >
                      {fileInfo.name}
                    </button>
                    {fileIndex < filePaths.length - 1 ? <span className="px-0.5">、</span> : null}
                  </span>
                ))}
              </span>
            ) : null}

            {searchLike && summary.sources.length > 0 ? <span>网站信息</span> : null}

            <span className="mx-0.5 text-zinc-300">|</span>
            <span className={`inline-flex items-center gap-1 ${meta.className}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`} />
              {meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
