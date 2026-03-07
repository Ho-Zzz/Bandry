import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircleIcon, BrainIcon, ChevronDownIcon, Loader2Icon } from "lucide-react";

import { buildProcessSteps, formatDuration, resolveLatestProcessDetail, type TraceItem } from "./trace-utils";

type ProcessLayerProps = {
  items: TraceItem[];
  isRunning: boolean;
  statusLabel: string;
};

export const ProcessLayer = ({ items, isRunning, statusLabel }: ProcessLayerProps) => {
  // Auto-expand when running, collapse when completed
  const [expanded, setExpanded] = useState(isRunning);

  const elapsed = useMemo(() => {
    const timestamps = items.map((item) => item.timestamp).filter((value): value is number => value !== undefined);
    if (timestamps.length < 2) {
      return null;
    }

    return formatDuration(Math.max(...timestamps) - Math.min(...timestamps));
  }, [items]);

  const hasError = items.some((item) => item.status === "failed" || item.stage === "error");
  const processSteps = useMemo(() => buildProcessSteps(items, isRunning, statusLabel), [items, isRunning, statusLabel]);
  const latestDetail = useMemo(() => resolveLatestProcessDetail(items), [items]);

  // Auto-expand when running starts
  const prevIsRunning = useRef(isRunning);
  useEffect(() => {
    if (isRunning && !prevIsRunning.current) {
      setExpanded(true);
    }
    prevIsRunning.current = isRunning;
  }, [isRunning]);

  // Show layer even when no items yet during initial generation.
  if (items.length === 0 && !isRunning) {
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
          <span className="text-xs font-medium text-zinc-700">{statusLabel}</span>
          {elapsed ? <span className="text-xs text-zinc-500">{elapsed}</span> : null}
        </div>

        <ChevronDownIcon size={14} className={expanded ? "text-zinc-500 rotate-180" : "text-zinc-500"} />
      </button>

      {!expanded ? (
        latestDetail ? <p className="pl-6 text-xs text-zinc-500">{latestDetail}</p> : null
      ) : (
        <div className="mt-2 space-y-2 pl-6">
          <div className="flex flex-wrap items-center gap-2">
            {processSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-2">
                <span
                  className={
                    step.tone === "error"
                      ? "rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700"
                      : step.tone === "active"
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                        : "rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600"
                  }
                >
                  {step.label}
                </span>
                {step.id !== processSteps[processSteps.length - 1]?.id ? (
                  <span className="text-[11px] text-zinc-300">-</span>
                ) : null}
              </div>
            ))}
          </div>

          {latestDetail ? <p className="text-xs text-zinc-500">{latestDetail}</p> : null}
        </div>
      )}
    </div>
  );
};
