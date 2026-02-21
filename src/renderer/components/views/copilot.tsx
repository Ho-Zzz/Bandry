/**
 * Copilot View Component
 *
 * Single-column ChatGPT-like interface for interacting with the AI agent.
 */

import { useState, useRef, useEffect } from "react";
import {
  Card,
  Button,
  Textarea,
  Chip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import {
  Send,
  Settings,
  Trash2,
  Loader2,
  User,
  Bot,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { clsx } from "clsx";
import { ModelSelector } from "../../components/chat/model-selector";
import { useCopilotChat } from "../../features/copilot/use-copilot-chat";
import type { Message } from "../../features/copilot/use-copilot-chat";

/**
 * Message Component
 */
const MessageBubble = ({ message }: { message: Message }) => {
  const [showTrace, setShowTrace] = useState(false);
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <Chip size="sm" variant="flat" color="default">
          {message.content}
        </Chip>
      </div>
    );
  }

  return (
    <div className={clsx("flex gap-3 mb-6", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={clsx(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isUser ? "bg-blue-500" : "bg-gray-200"
        )}
      >
        {isUser ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot size={16} className="text-gray-600" />
        )}
      </div>

      {/* Message Content */}
      <div className={clsx("flex flex-col gap-2 max-w-[70%]", isUser ? "items-end" : "items-start")}>
        <div
          className={clsx(
            "rounded-2xl px-4 py-3 text-sm",
            isUser
              ? "bg-blue-500 text-white"
              : message.status === "error"
              ? "bg-red-50 text-red-900 border border-red-200"
              : "bg-gray-100 text-gray-900"
          )}
        >
          {message.status === "pending" && !message.content ? (
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-gray-500">Thinking...</span>
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          )}
        </div>

        {/* Trace (for assistant messages) */}
        {!isUser && message.trace && message.trace.length > 0 && (
          <div className="w-full">
            <Button
              size="sm"
              variant="light"
              onPress={() => setShowTrace(!showTrace)}
              className="text-xs text-gray-500"
              startContent={showTrace ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            >
              {showTrace ? "Hide" : "Show"} trace ({message.trace.length})
            </Button>
            {showTrace && (
              <Card className="mt-2 p-3 bg-gray-50">
                <div className="space-y-2">
                  {message.trace.map((event, idx) => (
                    <div key={idx} className="text-xs">
                      <Chip size="sm" variant="flat" color="default" className="mb-1">
                        {event.stage}
                      </Chip>
                      <p className="text-gray-600 ml-2">{event.message}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Status indicator */}
        {message.status === "error" && (
          <span className="text-xs text-red-500">Failed to send</span>
        )}
      </div>
    </div>
  );
};

/**
 * Copilot View Component
 */
export const Copilot = () => {
  const [inputValue, setInputValue] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, clearMessages, isLoading } = useCopilotChat({
    modelProfileId: selectedProvider,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim() && !isLoading) {
      sendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Bandry Assistant</h1>
          <ModelSelector
            value={selectedProvider}
            onChange={setSelectedProvider}
            className="w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          <Dropdown>
            <DropdownTrigger>
              <Button variant="light" size="sm" isIconOnly>
                <Settings size={18} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Chat actions">
              <DropdownItem
                key="clear"
                startContent={<Trash2 size={14} />}
                onPress={clearMessages}
              >
                Clear conversation
              </DropdownItem>
              <DropdownItem
                key="settings"
                startContent={<Settings size={14} />}
                href="/settings"
              >
                Settings
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-6">
              <Bot size={40} className="text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">How can I help you today?</h2>
            <p className="text-gray-500 max-w-md">
              Describe what you want to accomplish and I'll break it down into tasks and execute
              them for you.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 shrink-0">
        <div className="max-w-4xl mx-auto flex items-end gap-3">
          <Textarea
            placeholder="Type your message... (Shift+Enter for new line)"
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={handleKeyDown}
            minRows={1}
            maxRows={6}
            className="flex-1"
            classNames={{
              input: "text-sm",
              inputWrapper: "bg-white",
            }}
            isDisabled={isLoading}
          />
          <Button
            color="primary"
            onPress={handleSend}
            isDisabled={!inputValue.trim() || isLoading}
            isIconOnly
            className="h-10 w-10"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </Button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
