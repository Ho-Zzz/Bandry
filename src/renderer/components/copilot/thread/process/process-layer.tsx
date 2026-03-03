import { useMemo, useState } from "react";
import { AlertCircleIcon, BrainIcon, ChevronDownIcon, Loader2Icon } from "lucide-react";

import { formatDuration, type TraceItem } from "./trace-utils";

type ProcessLayerProps = {
  items: TraceItem[];
  isRunning: boolean;
};

export const ProcessLayer = ({ items, isRunning }: ProcessLayerProps) => {
  const [expanded, setExpanded] = useState(false);

  const elapsed = useMemo(() => {
    const timestamps = items.map((item) => item.timestamp).filter((value): value is number => value !== undefined);
    if (timestamps.length < 2) {
      return null;
    }

    return formatDuration(Math.max(...timestamps) - Math.min(...timestamps));
  }, [items]);

  const latest = items[items.length - 1];
  const hasError = items.some((item) => item.status === "failed" || item.stage === "error");

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((previous) => !previous)}
        className="flex w-full items-center justify-between gap-3 px-1 py-1.5 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          {hasError ? (
            <AlertCircleIcon size={13} className="shrink-0 text-rose-500" />
          ) : isRunning ? (
            <Loader2Icon size={13} className="shrink-0 animate-spin text-emerald-600" />
          ) : (
            <BrainIcon size={13} className="shrink-0 text-emerald-700" />
          )}
          <span className="text-xs font-medium text-zinc-700">{isRunning ? "Thinking" : "Reasoning"}</span>
          <span className="text-xs text-zinc-500">
            {items.length} steps
            {elapsed ? ` · ${elapsed}` : ""}
          </span>
        </div>

        <ChevronDownIcon size={14} className={expanded ? "text-zinc-500 rotate-180" : "text-zinc-500"} />
      </button>

      {!expanded ? (
        <p className="pl-6 text-xs text-zinc-500">{latest?.message}</p>
      ) : (
        <div className="mt-1 max-h-44 overflow-y-auto pl-6">
          <div className="space-y-1">
            {items.slice(-8).map((item) => (
              <div key={item.id} className="flex items-start gap-1 text-xs text-zinc-500">
                <span className="mt-[2px] text-zinc-300">•</span>
                <span>{item.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
