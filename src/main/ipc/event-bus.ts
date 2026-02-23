import { BrowserWindow } from "electron";
import type { ChatDeltaEvent, ChatUpdateEvent, TaskUpdateEvent } from "../../shared/ipc";

const broadcast = (channel: "task:update" | "chat:update" | "chat:delta", payload: unknown): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, payload);
  }
};

export type IpcEventBus = {
  broadcastTaskUpdate: (update: TaskUpdateEvent) => void;
  broadcastChatUpdate: (update: ChatUpdateEvent) => void;
  broadcastChatDelta: (update: ChatDeltaEvent) => void;
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
    }
  };
};
