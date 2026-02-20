import { useEffect, useState } from "react";
import type { RuntimeConfigSummary } from "../../../shared/ipc";
import { ChatPanel } from "./components/legacy/chat-panel";
import { RuntimeConfigCard } from "./components/legacy/runtime-config-card";
import { RuntimeStatusCard } from "./components/legacy/runtime-status-card";
import { SandboxSmokeCard } from "./components/legacy/sandbox-smoke-card";
import type { PingState } from "./types";
import { useChatSession } from "./hooks/use-chat-session";

const ChatApp = () => {
  const { messages, input, sending, setInput, sendMessage, onInputKeyDown } = useChatSession();
  const [configSummary, setConfigSummary] = useState<RuntimeConfigSummary | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(false);
  const [pingState, setPingState] = useState<PingState>("idle");
  const [sandboxPath, setSandboxPath] = useState<string>("/mnt/workspace");
  const [sandboxOutput, setSandboxOutput] = useState<string>("No sandbox action yet.");
  const [sandboxBusy, setSandboxBusy] = useState<boolean>(false);

  const loadConfigSummary = async (): Promise<void> => {
    setIsLoadingConfig(true);
    try {
      const next = await window.api.getConfigSummary();
      setConfigSummary(next);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  useEffect(() => {
    void loadConfigSummary();
  }, []);

  const runPing = async (): Promise<void> => {
    setPingState("checking");
    try {
      await window.api.ping();
      setPingState("ok");
    } catch {
      setPingState("error");
    }
  };

  const runSandboxAction = async (action: "list" | "read" | "exec"): Promise<void> => {
    setSandboxBusy(true);
    try {
      if (action === "list") {
        const result = await window.api.sandboxListDir({ path: sandboxPath });
        const names = result.entries.map((entry) => `${entry.type.padEnd(9)} ${entry.name}`).join("\n");
        setSandboxOutput(names || "(empty)");
        return;
      }

      if (action === "read") {
        const result = await window.api.sandboxReadFile({ path: sandboxPath });
        setSandboxOutput(result.content.slice(0, 2000) || "(empty file)");
        return;
      }

      const result = await window.api.sandboxExec({
        command: "ls",
        args: ["-la", sandboxPath],
        cwd: "/mnt/workspace"
      });
      const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
      setSandboxOutput(output || `(exit=${result.exitCode})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sandbox action failed";
      setSandboxOutput(`ERROR: ${message}`);
    } finally {
      setSandboxBusy(false);
    }
  };

  return (
    <main className="app">
      <section className="panel">
        <div className="chat-layout">
          <ChatPanel
            messages={messages}
            input={input}
            sending={sending}
            onInputChange={setInput}
            onInputKeyDown={onInputKeyDown}
            onSend={() => {
              void sendMessage();
            }}
          />

          <aside className="side-column">
            <RuntimeStatusCard
              pingState={pingState}
              isLoadingConfig={isLoadingConfig}
              onPing={() => {
                void runPing();
              }}
              onReloadConfig={() => {
                void loadConfigSummary();
              }}
            />
            <RuntimeConfigCard configSummary={configSummary} />
            <SandboxSmokeCard
              sandboxPath={sandboxPath}
              sandboxOutput={sandboxOutput}
              sandboxBusy={sandboxBusy}
              onSandboxPathChange={setSandboxPath}
              onSandboxAction={(action) => {
                void runSandboxAction(action);
              }}
            />
          </aside>
        </div>
      </section>
    </main>
  );
};

export default ChatApp;
