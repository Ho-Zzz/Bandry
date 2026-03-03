import type { CSSProperties } from "react";
import { AuiIf, ThreadPrimitive } from "@assistant-ui/react";

import type { ChatMode } from "../../../../shared/ipc";
import type { PendingClarification } from "../../../features/copilot/use-copilot-chat";
import { ClarificationPanel } from "../clarification-panel";
import { CopilotComposer } from "../composer/copilot-composer";
import { ThreadWelcome } from "./thread-welcome";
import { EditComposer } from "./messages/edit-composer";
import { MessageItem } from "./messages/message-item";

type CopilotThreadProps = {
  pendingClarification: PendingClarification | null;
  clarificationInput: string;
  chatMode: ChatMode;
  isLoading: boolean;
  onClarificationInputChange: (value: string) => void;
  onClarificationOptionSelect: (value: string) => void;
  onClarificationCustomSubmit: () => void;
  onChatModeChange: (mode: ChatMode) => void;
  onCancelGeneration: () => void;
};

export const CopilotThread = ({
  pendingClarification,
  clarificationInput,
  chatMode,
  isLoading,
  onClarificationInputChange,
  onClarificationOptionSelect,
  onClarificationCustomSubmit,
  onChatModeChange,
  onCancelGeneration
}: CopilotThreadProps) => {
  return (
    <ThreadPrimitive.Root
      className="flex min-h-0 flex-1 flex-col bg-white text-sm"
      style={{
        "--thread-max-width": "48rem",
        "--accent-color": "#10b981",
        "--accent-foreground": "#ffffff"
      } as CSSProperties}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="bottom"
        className="relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable] scroll-smooth px-4 pt-4"
      >
        <AuiIf condition={(s) => s.thread.isEmpty}>
          <ThreadWelcome />
        </AuiIf>

        <ThreadPrimitive.Messages
          components={{
            Message: MessageItem,
            EditComposer
          }}
        />

        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mx-auto mt-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-2 overflow-visible rounded-t-3xl bg-white pb-4">
          <ClarificationPanel
            pendingClarification={pendingClarification}
            clarificationInput={clarificationInput}
            isLoading={isLoading}
            onClarificationInputChange={onClarificationInputChange}
            onClarificationOptionSelect={onClarificationOptionSelect}
            onClarificationCustomSubmit={onClarificationCustomSubmit}
          />
          <CopilotComposer
            chatMode={chatMode}
            isLoading={isLoading}
            onChatModeChange={onChatModeChange}
            onCancelGeneration={onCancelGeneration}
          />
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};
