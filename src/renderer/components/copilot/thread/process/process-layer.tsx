import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircleIcon,
  BotIcon,
  BrainIcon,
  ChevronDownIcon,
  FileTextIcon,
  FolderSearch2Icon,
  GlobeIcon,
  HardDriveDownloadIcon,
  Loader2Icon,
  SearchIcon,
  WrenchIcon
} from "lucide-react";

import { buildProcessLineItems, formatDuration, type ProcessLineIcon, type ProcessLineItem, type TraceItem } from "./trace-utils";
import type { ChatMode } from "../../../../../shared/ipc";

type ProcessLayerProps = {
  items: TraceItem[];
  isRunning: boolean;
  mode?: ChatMode;
  thinkingEnabled?: boolean;
};

const resolveLineIcon = (icon: ProcessLineIcon, status: ProcessLineItem["status"]) => {
  const className =
    status === "failed"
      ? "text-rose-600"
      : status === "running"
        ? "text-emerald-600"
        : "text-zinc-500";

  if (icon === "memory") {
    return <BrainIcon size={14} className={className} />;
  }
  if (icon === "search") {
    return <SearchIcon size={14} className={className} />;
  }
  if (icon === "web") {
    return <GlobeIcon size={14} className={className} />;
  }
  if (icon === "file") {
    return <FolderSearch2Icon size={14} className={className} />;
  }
  if (icon === "write") {
    return <HardDriveDownloadIcon size={14} className={className} />;
  }
  if (icon === "subagent") {
    return <BotIcon size={14} className={className} />;
  }
  if (icon === "answer") {
    return <FileTextIcon size={14} className={className} />;
  }
  if (icon === "error") {
    return <AlertCircleIcon size={14} className={className} />;
  }
  return <WrenchIcon size={14} className={className} />;
};

export const ProcessLayer = ({ items, isRunning, mode, thinkingEnabled }: ProcessLayerProps) => {
  const [expanded, setExpanded] = useState(false);
  const [userToggled, setUserToggled] = useState(false);
  const lines = useMemo(
    () =>
      buildProcessLineItems(items, isRunning, {
        mode,
        thinkingEnabled
      }),
    [items, isRunning, mode, thinkingEnabled]
  );

  const elapsed = useMemo(() => {
    const timestamps = items.map((item) => item.timestamp).filter((value): value is number => value !== undefined);
    if (timestamps.length < 2) {
      return null;
    }

    return formatDuration(Math.max(...timestamps) - Math.min(...timestamps));
  }, [items]);

  const hasError = lines.some((line) => line.status === "failed");
  const latestLine = lines[lines.length - 1];
  const modeLabel = (() => {
    if (mode === "thinking" || thinkingEnabled) {
      return "思考";
    }
    if (mode === "subagents") {
      return "协作";
    }
    return "执行";
  })();

  const prevIsRunning = useRef(isRunning);
  useEffect(() => {
    if (isRunning && !prevIsRunning.current) {
      if (!userToggled) {
        setExpanded(true);
      }
    }
    if (!isRunning && prevIsRunning.current) {
      if (!userToggled) {
        setExpanded(false);
      }
    }
    prevIsRunning.current = isRunning;
  }, [isRunning, userToggled]);

  if (lines.length === 0) {
    return null;
  }

  const visibleLines = expanded ? lines : latestLine ? [latestLine] : [];

  return (
    <div className="mt-1 px-1 py-1">
      <button
        type="button"
        onClick={() => {
          setUserToggled(true);
          setExpanded((previous) => !previous);
        }}
        className="flex w-full items-center justify-between gap-3 px-1 py-1.5 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          {hasError ? (
            <AlertCircleIcon size={13} className="shrink-0 text-rose-500" />
          ) : isRunning ? (
            <Loader2Icon size={13} className="shrink-0 animate-spin text-emerald-600" />
          ) : mode === "subagents" ? (
            <BotIcon size={13} className="shrink-0 text-zinc-500" />
          ) : (
            <BrainIcon size={13} className="shrink-0 text-zinc-500" />
          )}
          <span className="text-xs font-medium text-zinc-700">{expanded ? `${modeLabel}步骤 (${lines.length})` : `${modeLabel}过程`}</span>
          {elapsed ? <span className="text-xs text-zinc-500">{elapsed}</span> : null}
        </div>

        <ChevronDownIcon size={14} className={expanded ? "rotate-180 text-zinc-500" : "text-zinc-500"} />
      </button>

      <div className="mt-1 space-y-1 pl-1">
        {visibleLines.map((line) => (
          <div key={line.id} className="flex items-start gap-2.5 py-0.5">
            <div className={line.status === "running" ? "pt-0.5" : "pt-0.5"}>
              {resolveLineIcon(line.icon, line.status)}
            </div>
            <div className="min-w-0">
              <p
                className={
                  line.status === "failed"
                    ? "text-xs text-rose-700"
                    : line.status === "running"
                      ? "text-xs text-zinc-800"
                      : "text-xs text-zinc-700"
                }
              >
                {line.title}
                {line.status === "running" ? "..." : ""}
              </p>
            </div>
          </div>
        ))}
      </div>

      {!expanded && lines.length > 1 ? (
        <p className="mt-1 pl-2 text-[11px] text-zinc-500">
          已折叠 {lines.length - 1} 个步骤，点击展开查看完整过程
        </p>
      ) : null}
    </div>
  );
};
