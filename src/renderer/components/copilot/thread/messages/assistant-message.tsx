import { useMemo } from "react";
import { MessagePrimitive, useAuiState } from "@assistant-ui/react";
import { BotIcon, Loader2Icon } from "lucide-react";

import { ProcessLayer } from "../process/process-layer";
import { ToolResultLayer } from "../process/tool-result-layer";
import {
  buildToolSummaries,
  extractTraceItems
} from "../process/trace-utils";
import { AssistantActionBar, BranchPicker, MessageError } from "./message-action-bars";
import { AssistantTextPart, HiddenTraceGroup, HiddenTracePart } from "./message-parts";

const hasRenderableText = (parts: readonly unknown[]): boolean => {
  return parts.some((part) => {
    if (typeof part !== "object" || part === null) {
      return false;
    }

    const partRecord = part as Record<string, unknown>;
    if (partRecord.type !== "text") {
      return false;
    }

    return typeof partRecord.text === "string" && partRecord.text.trim().length > 0;
  });
};

export const AssistantMessage = () => {
  const status = useAuiState((s) => s.message.status);
  const parts = useAuiState((s) => s.message.parts);
  const statusType = status?.type;
  const isRunning = statusType === "running";

  const hasTextPart = useMemo(() => hasRenderableText(parts), [parts]);
  const traceItems = useMemo(() => extractTraceItems(parts), [parts]);
  const toolSummaries = useMemo(() => buildToolSummaries(traceItems, isRunning), [isRunning, traceItems]);
  const hasProcess = traceItems.length > 0;

  return (
    <MessagePrimitive.Root className="relative mx-auto w-full max-w-[var(--thread-max-width)] py-3" data-role="assistant">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <BotIcon size={15} />
        </div>

        <div className="min-w-0 flex-1 space-y-2 break-words px-1 leading-relaxed text-zinc-900">
          {isRunning && !hasTextPart && !hasProcess ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <Loader2Icon size={14} className="animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          ) : (
            <>
              <ProcessLayer items={traceItems} isRunning={isRunning} />
              <ToolResultLayer summaries={toolSummaries} />
              <MessagePrimitive.Parts
                components={{
                  Text: AssistantTextPart,
                  tools: {
                    Fallback: HiddenTracePart
                  },
                  ToolGroup: HiddenTraceGroup
                }}
              />
            </>
          )}

          <MessageError />

          <div className="mt-1 ml-1 flex min-h-6 items-center">
            <BranchPicker />
            <AssistantActionBar />
          </div>
        </div>
      </div>

      {statusType === "incomplete" ? <span className="ml-11 text-xs text-rose-600">Failed to send</span> : null}
    </MessagePrimitive.Root>
  );
};
