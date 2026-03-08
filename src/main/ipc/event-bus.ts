import { BrowserWindow } from "electron";
import type { ChatDeltaEvent, ChatUpdateEvent, ConversationResult, CronRunEvent, TaskUpdateEvent } from "../../shared/ipc";
import type { ChannelStatusEvent } from "../channels/types";

const broadcast = (
  channel: "task:update" | "chat:update" | "chat:delta" | "channel:status" | "conversation:update" | "cron:run-event",
  payload: unknown
): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
};

export type IpcEventBus = {
  broadcastTaskUpdate: (update: TaskUpdateEvent) => void;
  broadcastChatUpdate: (update: ChatUpdateEvent) => void;
  broadcastChatDelta: (update: ChatDeltaEvent) => void;
  broadcastConversationUpdate: (update: ConversationResult) => void;
  broadcastChannelStatus: (update: ChannelStatusEvent) => void;
  broadcastCronRunEvent: (event: CronRunEvent) => void;
};

export const createIpcEventBus = (): IpcEventBus => {
  return {
    broadcastTaskUpdate: (update) => {
      broadcast("task:update", update);
    },
    broadcastChatUpdate: (update) => {
      broadcast("chat:update", update);
    },
    broadcastChatDelta: (update) => {
      broadcast("chat:delta", update);
    },
    broadcastConversationUpdate: (update) => {
      broadcast("conversation:update", update);
    },
    broadcastChannelStatus: (update) => {
      broadcast("channel:status", update);
    },
    broadcastCronRunEvent: (event) => {
      broadcast("cron:run-event", event);
    }
  };
};
