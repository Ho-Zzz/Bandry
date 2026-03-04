import { useMemo } from "react";
import { MessagePrimitive, useAuiState } from "@assistant-ui/react";
import { BotIcon } from "lucide-react";

import { ProcessLayer } from "../process/process-layer";
import { ToolResultLayer } from "../process/tool-result-layer";
import {
  buildToolSummaries,
  extractTraceItems
} from "../process/trace-utils";
import { AssistantActionBar, BranchPicker, MessageError } from "./message-action-bars";
import { AssistantTextPart, HiddenTraceGroup, HiddenTracePart } from "./message-parts";
import { TokenBadge } from "../../token-badge";

export const AssistantMessage = () => {
  const status = useAuiState((s) => s.message.status);
  const parts = useAuiState((s) => s.message.parts);
  const metadata = useAuiState((s) => s.message.metadata);
  const statusType = status?.type;
  const isRunning = statusType === "running";

  const traceItems = useMemo(() => extractTraceItems(parts), [parts]);
  const toolSummaries = useMemo(() => buildToolSummaries(traceItems, isRunning), [isRunning, traceItems]);

  // Extract token data from metadata
  const tokenData = useMemo(() => {
    const custom = metadata?.custom as Record<string, unknown> | undefined;
    return {
      prompt_tokens: custom?.prompt_tokens as number | undefined,
      completion_tokens: custom?.completion_tokens as number | undefined,
      total_tokens: custom?.total_tokens as number | undefined
    };
  }, [metadata]);

  return (
    <MessagePrimitive.Root className="relative mx-auto w-full max-w-[var(--thread-max-width)] py-3" data-role="assistant">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <BotIcon size={15} />
        </div>

        <div className="min-w-0 flex-1 space-y-2 break-words px-1 leading-relaxed text-zinc-900">
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

          <MessageError />

          <TokenBadge
            promptTokens={tokenData.prompt_tokens}
            completionTokens={tokenData.completion_tokens}
            totalTokens={tokenData.total_tokens}
          />

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
