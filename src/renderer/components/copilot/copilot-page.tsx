import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AssistantRuntimeProvider } from "@assistant-ui/react";

import { useCopilotRuntime } from "../../features/copilot/use-copilot-runtime";
import { useConversationStore } from "../../store/use-conversation-store";
import { usePreviewStore } from "../../store/use-preview-store";
import { PreviewPanel } from "./preview-panel";
import { CopilotHeader } from "./copilot-header";
import { LeadRouteAlert } from "./lead-route-alert";
import { useCopilotBootstrap } from "./hooks/use-copilot-bootstrap";
import { useCopilotPageState } from "./hooks/use-copilot-page-state";
import { CopilotThread } from "./thread/copilot-thread";
import { useModelCapabilities } from "../../hooks/use-model-capabilities";

export const CopilotPage = () => {
  const { conversationId: routeConversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const latestRouteConversationIdRef = useRef<string | undefined>(routeConversationId);

  const { state, setChatMode, setClarificationInput, clearClarificationInput, setThinkingEnabled } = useCopilotPageState();
  const { profilesLoading, leadRouteReady, memoryStatus } = useCopilotBootstrap();

  const { conversations, deleteConversation, fetchConversations } = useConversationStore();

  const {
    runtime,
    isLoading,
    conversationId,
    pendingClarification,
    cancelCurrentRequest,
    submitClarificationCustom,
    submitClarificationOption,
    workspacePath,
    activeModelProfileId
  } = useCopilotRuntime({
    conversationId: routeConversationId,
    mode: state.chatMode,
    thinkingEnabled: state.thinkingEnabled
  });
  const { supportsThinking, profileId: resolvedProfileId } = useModelCapabilities(activeModelProfileId);
  const latestProfileIdRef = useRef<string | undefined>(undefined);

  const setPreviewWorkspacePath = usePreviewStore((s) => s.setWorkspacePath);
  const isPreviewOpen = usePreviewStore((s) => s.isOpen);

  useEffect(() => {
    latestRouteConversationIdRef.current = routeConversationId;
  }, [routeConversationId]);

  useEffect(() => {
    setPreviewWorkspacePath(workspacePath);
  }, [setPreviewWorkspacePath, workspacePath]);

  useEffect(() => {
    if (!pendingClarification) {
      clearClarificationInput();
    }
  }, [clearClarificationInput, pendingClarification]);

  useEffect(() => {
    if (!resolvedProfileId) {
      return;
    }
    if (latestProfileIdRef.current === resolvedProfileId) {
      return;
    }
    latestProfileIdRef.current = resolvedProfileId;
    setThinkingEnabled(supportsThinking);
  }, [resolvedProfileId, setThinkingEnabled, supportsThinking]);

  useEffect(() => {
    const hasConversationInList = conversationId
      ? conversations.some((conversation) => conversation.id === conversationId)
      : false;

    if (conversationId && !routeConversationId && hasConversationInList) {
      navigate(`/copilot/${conversationId}`, { replace: true });
      void fetchConversations();
    }
  }, [conversationId, conversations, fetchConversations, navigate, routeConversationId]);

  const handleClearConversation = useCallback(async () => {
    const deletingConversationId = routeConversationId ?? conversationId;
    if (!deletingConversationId) {
      return;
    }

    await deleteConversation(deletingConversationId);
    await fetchConversations();

    // Avoid clobbering navigation if user switched to another chat while delete was in-flight.
    if (latestRouteConversationIdRef.current === deletingConversationId) {
      navigate("/copilot", { replace: true });
    }
  }, [conversationId, deleteConversation, fetchConversations, navigate, routeConversationId]);

  const handleClarificationOption = useCallback(
    async (value: string) => {
      await submitClarificationOption(value);
      clearClarificationInput();
    },
    [clearClarificationInput, submitClarificationOption]
  );

  const handleClarificationCustomSubmit = useCallback(async () => {
    const value = state.clarificationInput.trim();
    if (!value) {
      return;
    }

    await submitClarificationCustom(value);
    clearClarificationInput();
  }, [clearClarificationInput, state.clarificationInput, submitClarificationCustom]);

  const handleCancelGeneration = useCallback(() => {
    void cancelCurrentRequest();
  }, [cancelCurrentRequest]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-full w-full bg-white">
        <div className="flex min-w-0 flex-1 flex-col">
          <CopilotHeader
            memoryActive={Boolean(memoryStatus?.running)}
            canDeleteConversation={Boolean(routeConversationId ?? conversationId)}
            onDeleteConversation={() => {
              void handleClearConversation();
            }}
            onOpenSettings={() => {
              navigate("/settings");
            }}
          />

          {!profilesLoading && !leadRouteReady ? (
            <LeadRouteAlert
              onOpenModelStudio={() => {
                navigate("/model-studio");
              }}
            />
          ) : (
            <CopilotThread
              pendingClarification={pendingClarification}
              clarificationInput={state.clarificationInput}
              chatMode={state.chatMode}
              isLoading={isLoading}
              thinkingEnabled={state.thinkingEnabled}
              supportsThinking={supportsThinking}
              onClarificationInputChange={setClarificationInput}
              onClarificationOptionSelect={(value) => {
                void handleClarificationOption(value);
              }}
              onClarificationCustomSubmit={() => {
                void handleClarificationCustomSubmit();
              }}
              onChatModeChange={setChatMode}
              onThinkingEnabledChange={setThinkingEnabled}
              onCancelGeneration={handleCancelGeneration}
            />
          )}
        </div>

        {isPreviewOpen ? <PreviewPanel /> : null}
      </div>
    </AssistantRuntimeProvider>
  );
};
