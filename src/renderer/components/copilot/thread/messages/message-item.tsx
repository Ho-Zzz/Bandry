import { useAuiState } from "@assistant-ui/react";

import { AssistantMessage } from "./assistant-message";
import { SystemMessage } from "./system-message";
import { UserMessage } from "./user-message";

export const MessageItem = () => {
  const role = useAuiState((s) => s.message.role);

  if (role === "user") {
    return <UserMessage />;
  }

  if (role === "system") {
    return <SystemMessage />;
  }

  return <AssistantMessage />;
};
