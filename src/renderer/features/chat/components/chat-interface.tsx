import { useSessionStore } from "../../../store/use-session-store";
import { useParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";

export const ChatInterface = () => {
  const { sessionId } = useParams();
  const session = useSessionStore((state) => 
    state.sessions.find((s) => s.id === sessionId)
  );

  if (!session) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400">
        <MessageCircle size={48} className="mb-4 text-gray-300" />
        <p className="text-lg font-medium">Session not found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-gray-100 flex items-center px-6 justify-between bg-white/80 backdrop-blur-sm z-10">
        <div>
          <h2 className="font-semibold text-gray-900">{session.title}</h2>
          <p className="text-xs text-green-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Active Agent
          </p>
        </div>
      </div>

      {/* Messages Area (Placeholder for assistant-ui) */}
      <div className="flex-1 p-6 overflow-y-auto bg-white">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              A
            </div>
            <div className="flex-1">
              <div className="bg-gray-50 p-4 rounded-2xl rounded-tl-none text-gray-800 text-sm leading-relaxed">
                Hello! I'm your AI assistant. How can I help you today?
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-100">
        <div className="max-w-3xl mx-auto relative">
          <textarea
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none h-24"
            placeholder="Type a message..."
          />
          <button className="absolute bottom-3 right-3 bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-lg transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
