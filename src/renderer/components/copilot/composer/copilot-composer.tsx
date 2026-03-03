import { useState } from "react";
import { AuiIf, ComposerPrimitive } from "@assistant-ui/react";
import { ArrowUpIcon, BrainIcon, Maximize2Icon, Minimize2Icon, PaperclipIcon, SquareIcon, UsersIcon, ZapIcon } from "lucide-react";
import { clsx } from "clsx";

import type { ChatMode } from "../../../../shared/ipc";
import { ComposerAttachmentItem, IconButton } from "../assistant-ui/primitives";

type CopilotComposerProps = {
  chatMode: ChatMode;
  isLoading: boolean;
  onChatModeChange: (mode: ChatMode) => void;
  onCancelGeneration: () => void;
};

const modeOptions: Array<{
  value: ChatMode;
  label: string;
}> = [
  {
    value: "default",
    label: "Default"
  },
  {
    value: "thinking",
    label: "Thinking"
  },
  {
    value: "subagents",
    label: "Sub-Agents"
  }
];

const ModeIcon = ({ mode }: { mode: ChatMode }) => {
  if (mode === "thinking") {
    return <BrainIcon size={13} />;
  }

  if (mode === "subagents") {
    return <UsersIcon size={13} />;
  }

  return <ZapIcon size={13} />;
};

export const CopilotComposer = ({ chatMode, isLoading, onChatModeChange, onCancelGeneration }: CopilotComposerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <ComposerPrimitive.Root className="relative flex w-full flex-col">
      <ComposerPrimitive.AttachmentDropzone className="flex w-full flex-col rounded-3xl border border-zinc-300 bg-white px-1 pt-2 outline-none transition-shadow has-[textarea:focus-visible]:border-emerald-500 has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-emerald-200 data-[dragging=true]:border-emerald-500 data-[dragging=true]:border-dashed data-[dragging=true]:bg-emerald-50">
        <div className="mb-1 flex items-center justify-between px-3">
          <label className="inline-flex items-center gap-1 text-xs text-zinc-500">
            <ModeIcon mode={chatMode} />
            <span>Mode</span>
          </label>
          <select
            value={chatMode}
            onChange={(event) => onChatModeChange(event.target.value as ChatMode)}
            className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 outline-none"
            disabled={isLoading}
          >
            {modeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <ComposerPrimitive.Attachments
          components={{
            Attachment: ComposerAttachmentItem
          }}
        />

        <ComposerPrimitive.Input
          placeholder="沟通时请保持“公开可接受”"
          submitMode="enter"
          className={clsx(
            "mb-1 w-full resize-none bg-transparent px-4 pt-2 pb-3 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus-visible:ring-0",
            isExpanded ? "max-h-[360px] min-h-24" : "max-h-32 min-h-14"
          )}
          rows={1}
          autoFocus
          aria-label="Message input"
          disabled={isLoading}
        />

        <div className="relative mx-2 mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <ComposerPrimitive.AddAttachment asChild>
              <IconButton tooltip="Add attachment" className="h-8 w-8 rounded-full">
                <PaperclipIcon size={15} />
              </IconButton>
            </ComposerPrimitive.AddAttachment>

            <IconButton
              tooltip={isExpanded ? "Collapse input" : "Expand input"}
              className="h-8 w-8 rounded-full"
              onClick={() => setIsExpanded((previous) => !previous)}
            >
              {isExpanded ? <Minimize2Icon size={15} /> : <Maximize2Icon size={15} />}
            </IconButton>
          </div>

          <AuiIf condition={(s) => !s.thread.isRunning}>
            <ComposerPrimitive.Send asChild>
              <button
                type="submit"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
                aria-label="Send message"
              >
                <ArrowUpIcon size={15} />
              </button>
            </ComposerPrimitive.Send>
          </AuiIf>

          <AuiIf condition={(s) => s.thread.isRunning}>
            <ComposerPrimitive.Cancel asChild>
              <button
                type="button"
                onClick={onCancelGeneration}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-white"
                aria-label="Stop generating"
              >
                <SquareIcon size={12} className="fill-current" />
              </button>
            </ComposerPrimitive.Cancel>
          </AuiIf>
        </div>
      </ComposerPrimitive.AttachmentDropzone>

      <div className="mt-2 flex items-center justify-center text-xs text-zinc-400">Press Enter to send, Shift+Enter for new line</div>
    </ComposerPrimitive.Root>
  );
};
