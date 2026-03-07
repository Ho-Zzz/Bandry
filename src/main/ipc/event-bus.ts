import { BrowserWindow } from "electron";
import type { ChatDeltaEvent, ChatUpdateEvent, TaskUpdateEvent } from "../../shared/ipc";
import type { ChannelStatusEvent } from "../channels/types";

const broadcast = (channel: "task:update" | "chat:update" | "chat:delta" | "channel:status", payload: unknown): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
};

export type IpcEventBus = {
  broadcastTaskUpdate: (update: TaskUpdateEvent) => void;
  broadcastChatUpdate: (update: ChatUpdateEvent) => void;
  broadcastChatDelta: (update: ChatDeltaEvent) => void;
  broadcastChannelStatus: (update: ChannelStatusEvent) => void;
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
    broadcastChannelStatus: (update) => {
      broadcast("channel:status", update);
    }
  };
};
