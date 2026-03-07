import { GlobeIcon, LinkIcon, WrenchIcon } from "lucide-react";

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

  const renderStatus = (status: ToolResultSummary["status"]) => {
    const meta = statusMeta(status);
    return (
      <>
        <span className="mx-0.5 text-zinc-300">|</span>
        <span className={`inline-flex items-center gap-1 ${meta.className}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`} />
          {meta.label}
        </span>
      </>
    );
  };

  return (
    <div className="mt-2 space-y-1.5">
      {summaries.map((summary, index) => {
        const filePaths = extractFilePaths(summary.output);
        const searchLike = isSearchTool(summary.source);

        if (searchLike && summary.sources.length > 0) {
          return summary.sources.map((source) => (
            <div key={`${summary.source}-${source.id}`} className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
              <GlobeIcon size={12} className="text-zinc-400" />
              <span>{summary.status === "loading" ? "搜索中" : "已搜索"}</span>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 max-w-[26rem] items-center truncate rounded-md px-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                {source.url}
              </a>
              {renderStatus(summary.status)}
            </div>
          ));
        }

        if (filePaths.length > 0) {
          return filePaths.map((fileInfo) => (
            <div key={`${summary.source}-${fileInfo.path}`} className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
              <LinkIcon size={12} className="text-zinc-400" />
              <span>{summary.status === "loading" ? "处理中" : "已处理"}</span>
              <button
                type="button"
                className="inline-flex h-7 items-center rounded-md px-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                onClick={() => {
                  void openPreview(fileInfo.path, fileInfo.name, summary.workspacePath);
                }}
              >
                {fileInfo.name}
              </button>
              {renderStatus(summary.status)}
            </div>
          ));
        }

        return (
          <div key={`${summary.source}-${summary.timestamp ?? index}`} className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
            {searchLike ? <GlobeIcon size={12} className="text-zinc-400" /> : <WrenchIcon size={12} className="text-zinc-400" />}
            <span>{searchLike ? (summary.status === "loading" ? "搜索中" : "已搜索") : `${summary.status === "loading" ? "执行中" : "已执行"} ${summary.source}`}</span>
            {renderStatus(summary.status)}
          </div>
        );
      })}
    </div>
  );
};
