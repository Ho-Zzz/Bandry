import { BrowserWindow } from "electron";
import path from "node:path";

type CreateMainWindowInput = {
  devServerUrl?: string;
};

export const createMainWindow = async (input: CreateMainWindowInput): Promise<BrowserWindow> => {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  if (input.devServerUrl) {
    await window.loadURL(input.devServerUrl);
  } else {
    await window.loadFile(path.resolve(__dirname, "../dist/index.html"));
  }

  return window;
};
