/**
 * Sidebar Component
 *
 * macOS-style navigation sidebar with support for expanded and collapsed states.
 * Features main navigation, conversation list, and window control buttons.
 */

import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Users,
  Zap,
  FolderOpen,
  Cpu,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  MessageSquare,
  Plus,
  Settings
} from "lucide-react";
import { clsx } from "clsx";
import { useConversationStore } from "../../store/use-conversation-store";
import type { NavigationItem, SidebarState } from "../../types/app";
import type { ConversationResult } from "../../../shared/ipc";

interface SidebarProps {
  state: SidebarState;
  onStateChange: (state: SidebarState) => void;
  activeTaskCount?: number;
}

const CollapseToggle = ({
  state,
  onToggle
}: {
  state: SidebarState;
  onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 transition-all"
    title={state === "expanded" ? "Collapse sidebar" : "Expand sidebar"}
  >
    {state === "expanded" ? <ChevronLeft size={14} /> : <ChevronRightIcon size={14} />}
  </button>
);

const SectionHeader = ({
  title,
  isOpen,
  onClick,
  actionIcon,
  isCollapsed
}: {
  title: string;
  isOpen: boolean;
  onClick: () => void;
  actionIcon?: React.ReactNode;
  isCollapsed: boolean;
}) => {
  if (isCollapsed) {
    return (
      <div className="flex items-center justify-center py-2 mt-2">
        <div className="w-6 h-px bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-2.5 py-2 mt-4 text-[11px] font-bold text-gray-400 uppercase tracking-wide group">
      <div
        className="flex items-center cursor-pointer hover:text-gray-600 transition-colors"
        onClick={onClick}
      >
        <span className="mr-1 opacity-0 group-hover:opacity-100 transition-opacity -ml-3">
          {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </span>
        {title}
      </div>
      {actionIcon}
    </div>
  );
};

const NavItem = ({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge,
  isCollapsed
}: {
  icon: typeof Home;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
  isCollapsed: boolean;
}) => {
  if (isCollapsed) {
    return (
      <button
        onClick={onClick}
        className={clsx(
          "flex items-center justify-center w-10 h-10 rounded-xl transition-all mx-auto mb-2",
          isActive
            ? "bg-[#E3E4E8] text-blue-600"
            : "text-gray-500 hover:bg-[#EBECEF] hover:text-gray-900"
        )}
        title={label}
      >
        <Icon size={20} />
        {badge && badge > 0 && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white">
            {badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center w-full px-2.5 py-1.5 rounded-md text-[13px] font-medium cursor-pointer transition-all select-none mb-0.5",
        isActive
          ? "bg-[#E3E4E8] text-[#1c1c1e]"
          : "text-gray-600 hover:bg-[#EBECEF] hover:text-gray-900"
      )}
    >
      <Icon
        size={16}
        className={clsx("mr-2.5", isActive ? "text-blue-500" : "text-gray-500")}
      />
      <span className="truncate">{label}</span>
      {badge && badge > 0 && (
        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full min-w-[16px] h-4 flex items-center justify-center shadow-sm">
          {badge}
        </span>
      )}
    </button>
  );
};

const ConversationItem = ({
  conversation,
  isActive,
  onClick,
  isCollapsed
}: {
  conversation: ConversationResult;
  isActive: boolean;
  onClick: () => void;
  isCollapsed: boolean;
}) => {
  const displayTitle = conversation.title || "New Chat";
  const truncatedTitle = displayTitle.length > 24 ? displayTitle.slice(0, 21) + "..." : displayTitle;

  if (isCollapsed) {
    return (
      <button
        onClick={onClick}
        className={clsx(
          "flex items-center justify-center w-10 h-10 rounded-xl transition-all mx-auto mb-2",
          isActive
            ? "bg-[#E3E4E8] text-blue-600"
            : "text-gray-500 hover:bg-[#EBECEF] hover:text-gray-900"
        )}
        title={displayTitle}
      >
        <MessageSquare size={16} />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center w-full px-2.5 py-1.5 rounded-md text-[13px] font-medium cursor-pointer transition-all select-none mb-0.5",
        isActive
          ? "bg-[#E3E4E8] text-[#1c1c1e]"
          : "text-gray-600 hover:bg-[#EBECEF] hover:text-gray-900"
      )}
    >
      <MessageSquare size={12} className="mr-2 text-gray-400 shrink-0" />
      <span className="flex-1 truncate text-left">{truncatedTitle}</span>
    </button>
  );
};

export const Sidebar = ({
  state,
  onStateChange,
  activeTaskCount = 0
}: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [channelsOpen, setChannelsOpen] = useState(true);
  const { conversations, fetchConversations, setActiveConversation, createConversation } = useConversationStore();

  const isCollapsed = state === "collapsed";

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleNavClick = (navItem: NavigationItem) => {
    if (navItem.type === "view") {
      switch (navItem.id) {
        case "home":
          navigate("/");
          break;
        case "workflows":
          navigate("/workflows");
          break;
        case "assets":
          navigate("/assets");
          break;
        case "directory":
          navigate("/employees");
          break;
        case "models":
          navigate("/model-studio");
          break;
        case "settings":
          navigate("/settings");
          break;
      }
    } else if (navItem.type === "conversation") {
      setActiveConversation(navItem.id);
      navigate(`/copilot/${navItem.id}`);
    }
  };

  const handleNewChat = async () => {
    try {
      const conversation = await createConversation(undefined, undefined);
      setActiveConversation(conversation.id);
      navigate(`/copilot/${conversation.id}`);
    } catch (error) {
      console.error("Failed to create conversation:", error);
      setActiveConversation(null);
      navigate("/copilot");
    }
  };

  const isNavActive = (navItem: NavigationItem): boolean => {
    if (navItem.type === "view") {
      const pathMap: Record<string, string> = {
        home: "/",
        workflows: "/workflows",
        assets: "/assets",
        directory: "/employees",
        models: "/model-studio",
        settings: "/settings"
      };
      return location.pathname === pathMap[navItem.id];
    }
    if (navItem.type === "conversation") {
      return location.pathname === `/copilot/${navItem.id}`;
    }
    return false;
  };

  const toggleSidebar = () => {
    onStateChange(isCollapsed ? "expanded" : "collapsed");
  };

  return (
    <aside
      className={clsx(
        "h-full flex flex-col flex-shrink-0 z-20 transition-all duration-200 ease-in-out",
        "bg-[#F3F4F7]/95 border-r border-gray-200/80 backdrop-blur-xl",
        isCollapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      <div
        className={clsx(
          "h-12 flex items-center flex-shrink-0 drag-region select-none",
          isCollapsed ? "justify-center px-2" : "px-5 pt-2"
        )}
      >
        {isCollapsed ? (
          <CollapseToggle state={state} onToggle={toggleSidebar} />
        ) : (
          <div className="flex items-center justify-between w-full">
            <h1>Bandry</h1>
            <CollapseToggle state={state} onToggle={toggleSidebar} />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <nav className={clsx("space-y-0.5", isCollapsed && "mt-4")}>
          <NavItem
            icon={Home}
            label="Home"
            isActive={isNavActive({ type: "view", id: "home" })}
            onClick={() => handleNavClick({ type: "view", id: "home" })}
            badge={activeTaskCount}
            isCollapsed={isCollapsed}
          />
          <NavItem
            icon={Zap}
            label="Automations"
            isActive={isNavActive({ type: "view", id: "workflows" })}
            onClick={() => handleNavClick({ type: "view", id: "workflows" })}
            isCollapsed={isCollapsed}
          />
          <NavItem
            icon={FolderOpen}
            label="Files"
            isActive={isNavActive({ type: "view", id: "assets" })}
            onClick={() => handleNavClick({ type: "view", id: "assets" })}
            isCollapsed={isCollapsed}
          />
          <NavItem
            icon={Users}
            label="People"
            isActive={isNavActive({ type: "view", id: "directory" })}
            onClick={() => handleNavClick({ type: "view", id: "directory" })}
            isCollapsed={isCollapsed}
          />
          <NavItem
            icon={Cpu}
            label="Model Studio"
            isActive={isNavActive({ type: "view", id: "models" })}
            onClick={() => handleNavClick({ type: "view", id: "models" })}
            isCollapsed={isCollapsed}
          />
          <NavItem
            icon={Settings}
            label="Settings"
            isActive={isNavActive({ type: "view", id: "settings" })}
            onClick={() => handleNavClick({ type: "view", id: "settings" })}
            isCollapsed={isCollapsed}
          />
        </nav>

        <SectionHeader
          title="Chats"
          isOpen={channelsOpen}
          onClick={() => setChannelsOpen(!channelsOpen)}
          isCollapsed={isCollapsed}
          actionIcon={
            !isCollapsed && (
              <button
                onClick={() => {
                  void handleNewChat();
                }}
                className="p-1 rounded hover:bg-gray-200/50 text-gray-400 hover:text-gray-600 transition-colors"
                title="New Chat"
              >
                <Plus size={14} />
              </button>
            )
          }
        />

        {channelsOpen && (
          <div className="space-y-0.5">
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={isNavActive({ type: "conversation", id: conversation.id })}
                onClick={() => handleNavClick({ type: "conversation", id: conversation.id })}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
