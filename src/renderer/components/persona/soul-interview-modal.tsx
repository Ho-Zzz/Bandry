import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Textarea } from "@heroui/react";
import { Sparkles, Send, Check } from "lucide-react";
import Markdown from "react-markdown";

type InterviewMessage = {
  role: "user" | "assistant";
  content: string;
};

type Phase = "chatting" | "generating" | "preview";

interface SoulInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: { soulContent: string; identityContent: string }) => void;
}

const mdClass =
  "text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_h1]:text-base [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:my-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-1.5 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:my-1.5 [&_blockquote]:text-gray-600";

const generateSoul = async (
  history: InterviewMessage[],
  setGeneratedSoul: (s: { soulContent: string; identityContent: string }) => void,
  setPhase: (p: Phase) => void,
  setError: (e: string) => void
) => {
  setPhase("generating");
  setError("");
  try {
    const summary = await window.api.soulInterviewSummarize({ history });
    setGeneratedSoul(summary);
    setPhase("preview");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to generate Soul");
    setPhase("chatting");
  }
};

export const SoulInterviewModal = ({ isOpen, onClose, onApply }: SoulInterviewModalProps) => {
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("chatting");
  const [generatedSoul, setGeneratedSoul] = useState({ soulContent: "", identityContent: "" });
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const askAI = useCallback(async (history: InterviewMessage[]) => {
    setLoading(true);
    setError("");
    try {
      const result = await window.api.soulInterview({ history });
      const aiMessage: InterviewMessage = { role: "assistant", content: result.reply };
      const updated = [...history, aiMessage];
      setMessages(updated);

      if (result.done) {
        void generateSoul(updated, setGeneratedSoul, setPhase, setError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      void askAI([]);
    }
  }, [isOpen, messages.length, askAI]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: InterviewMessage = { role: "user", content: text };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput("");
    void askAI(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFinishAndGenerate = () => {
    if (messages.length < 2) return;
    void generateSoul(messages, setGeneratedSoul, setPhase, setError);
  };

  const handleRegenerate = () => {
    void generateSoul(messages, setGeneratedSoul, setPhase, setError);
  };

  const handleRestart = () => {
    setMessages([]);
    setPhase("chatting");
    setGeneratedSoul({ soulContent: "", identityContent: "" });
    setError("");
    setInput("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Sparkles size={18} className="text-purple-500" />
          {phase === "preview" ? "Generated Soul" : "Soul Interview"}
        </ModalHeader>

        <ModalBody className="min-h-[400px]">
          {phase === "chatting" && (
            <div className="flex flex-col h-full">
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-4 max-h-[350px]">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "user" ? (
                      <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-blue-500 text-white whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    ) : (
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 bg-gray-100 text-gray-800 ${mdClass}`}>
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl px-4 py-2.5 text-sm text-gray-400">
                      Thinking...
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-end gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your answer..."
                  disabled={loading}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50"
                />
                <Button
                  isIconOnly
                  color="primary"
                  size="sm"
                  onPress={handleSend}
                  isDisabled={!input.trim() || loading}
                  className="rounded-xl"
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          )}

          {phase === "generating" && (
            <div className="flex flex-col items-center justify-center h-[300px] gap-3">
              <Sparkles size={32} className="text-purple-400 animate-pulse" />
              <p className="text-sm text-gray-500">Generating your Soul profile...</p>
            </div>
          )}

          {phase === "preview" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Identity</label>
                <Textarea
                  minRows={4}
                  maxRows={8}
                  value={generatedSoul.identityContent}
                  onValueChange={(v) => setGeneratedSoul((s) => ({ ...s, identityContent: v }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Soul</label>
                <Textarea
                  minRows={8}
                  maxRows={16}
                  value={generatedSoul.soulContent}
                  onValueChange={(v) => setGeneratedSoul((s) => ({ ...s, soulContent: v }))}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 mt-2">{error}</p>
          )}
        </ModalBody>

        <ModalFooter>
          {phase === "chatting" && (
            <>
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button
                color="success"
                variant="flat"
                startContent={<Check size={14} />}
                onPress={handleFinishAndGenerate}
                isDisabled={messages.length < 2 || loading}
              >
                Finish & Generate Soul
              </Button>
            </>
          )}
          {phase === "preview" && (
            <>
              <Button variant="light" onPress={handleRestart}>
                Start Over
              </Button>
              <Button variant="flat" onPress={handleRegenerate}>
                Regenerate
              </Button>
              <Button color="primary" onPress={() => onApply(generatedSoul)}>
                Apply to Soul
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
