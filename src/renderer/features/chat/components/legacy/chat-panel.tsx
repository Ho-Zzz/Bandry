import { useEffect, useRef, type KeyboardEventHandler } from "react";
import type { ChatMessage } from "../../types";

type ChatPanelProps = {
  messages: ChatMessage[];
  input: string;
  sending: boolean;
  onInputChange: (value: string) => void;
  onInputKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onSend: () => void;
};

const mapRoleLabel = (role: ChatMessage["role"]): string => {
  if (role === "user") {
    return "You";
  }
  if (role === "assistant") {
    return "Agent";
  }
  return "System";
};

export const ChatPanel = ({
  messages,
  input,
  sending,
  onInputChange,
  onInputKeyDown,
  onSend
}: ChatPanelProps) => {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <section className="chat-column">
      <div className="chat-header">
        <h1>Bandry Chat</h1>
        <p>对话原型（DeepSeek）：输入问题后直接返回模型回复。</p>
      </div>

      <div className="chat-stream">
        {messages.map((message) => (
          <article key={message.id} className={`message message-${message.role}`}>
            <header className="message-meta">
              <strong>{mapRoleLabel(message.role)}</strong>
              {message.pending ? <span>thinking...</span> : null}
              {message.meta ? <span>{message.meta}</span> : null}
            </header>
            <pre>{message.content}</pre>
          </article>
        ))}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={onInputKeyDown}
          rows={4}
          placeholder="问我任何开发问题，Shift+Enter 换行，Enter 发送"
        />
        <div className="button-row">
          <button type="button" onClick={onSend} disabled={sending || !input.trim()}>
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </section>
  );
};
