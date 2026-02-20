import { useNavigate, useParams } from "react-router-dom";
import { Plus, Search, MoreHorizontal, Pin } from "lucide-react";
import { clsx } from "clsx";
import { useSessionStore } from "../../../store/use-session-store";
import { Button } from "@heroui/react";

const SessionItem = ({ 
  title, 
  active, 
  pinned,
  lastMessage,
  onClick 
}: { 
  title: string; 
  active: boolean; 
  pinned: boolean;
  lastMessage?: string;
  onClick: () => void;
}) => (
  <div
    onClick={onClick}
    className={clsx(
      "group flex items-center gap-3 p-3 mx-2 rounded-lg cursor-pointer transition-colors relative",
      active ? "bg-blue-50" : "hover:bg-gray-100"
    )}
  >
    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium shrink-0">
      {title.charAt(0)}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-center mb-0.5">
        <h3 className={clsx("font-medium text-sm truncate", active ? "text-blue-900" : "text-gray-900")}>
          {title}
        </h3>
        {pinned && <Pin size={12} className="text-gray-400 rotate-45" />}
      </div>
      <p className="text-xs text-gray-500 truncate">
        {lastMessage || "No messages yet"}
      </p>
    </div>
    
    {/* Hover Actions (visible on hover) */}
    <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600">
        <MoreHorizontal size={14} />
      </button>
    </div>
  </div>
);

export const SessionList = () => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { sessions, activeSessionId, createSession, setActiveSession } = useSessionStore();

  const handleCreateNew = () => {
    // For now, create a default session
    const newId = createSession("default-agent");
    navigate(`/chat/${newId}`);
  };

  const handleSelectSession = (id: string) => {
    setActiveSession(id);
    navigate(`/chat/${id}`);
  };

  return (
    <div className="w-80 h-full flex flex-col bg-gray-50/50 border-r border-gray-200">
      {/* Header */}
      <div className="p-4 flex items-center justify-between shrink-0">
        <h2 className="text-lg font-bold text-gray-800">Messages</h2>
        <Button 
          isIconOnly
          size="sm" 
          variant="light" 
          onPress={handleCreateNew}
          className="text-gray-500 hover:text-blue-600"
        >
          <Plus size={20} />
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 mb-2 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search" 
            className="w-full bg-white border border-gray-200 rounded-md py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
            <p>No conversations yet</p>
            <Button 
              size="sm" 
              variant="flat" 
              color="primary" 
              className="mt-2"
              onPress={handleCreateNew}
            >
              Start Chat
            </Button>
          </div>
        ) : (
          sessions.map((session) => (
            <SessionItem
              key={session.id}
              title={session.title}
              active={session.id === (sessionId || activeSessionId)}
              pinned={session.pinned}
              lastMessage={session.lastMessage}
              onClick={() => handleSelectSession(session.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};
