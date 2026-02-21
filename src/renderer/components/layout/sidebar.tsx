/**
 * Sidebar Component
 *
 * macOS-style navigation sidebar with support for expanded and collapsed states.
 * Features main navigation, channel list, tasks, and direct messages with online status indicators.
 * Includes window control buttons (traffic lights) for macOS native feel.
 */

import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Users,
  Zap,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Plus,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
} from "lucide-react";
import { clsx } from "clsx";
import { useTaskStore } from "../../store/use-task-store";
import type { NavigationItem, SidebarState } from "../../types/app";
import type { DAGTask, TaskStatus } from "../../types/task";

interface SidebarProps {
  /** Current state of the sidebar (expanded or collapsed) */
  state: SidebarState;
  /** Callback when sidebar state changes */
  onStateChange: (state: SidebarState) => void;
  /** Number of active tasks waiting for review (shown as badge on Home) */
  activeTaskCount?: number;
}

/**
 * CollapseToggle Component
 * Button to toggle sidebar between expanded and collapsed states
 */
const CollapseToggle = ({
  state,
  onToggle,
}: {
  state: SidebarState;
  onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 transition-all"
    title={state === "expanded" ? "Collapse sidebar" : "Expand sidebar"}
  >
    {state === "expanded" ? (
      <ChevronLeft size={14} />
    ) : (
      <ChevronRightIcon size={14} />
    )}
  </button>
);

/**
 * SectionHeader Component
 * Collapsible section header for channels and DMs
 */
const SectionHeader = ({
  title,
  isOpen,
  onClick,
  actionIcon,
  isCollapsed,
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

/**
 * NavigationItem Component
 * Individual navigation item with icon, label, and active state
 */
const NavItem = ({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge,
  isCollapsed,
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
            : "text-gray-500 hover:bg-[#EBECEF] hover:text-gray-900",
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
          : "text-gray-600 hover:bg-[#EBECEF] hover:text-gray-900",
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

/**
 * ChannelItem Component (unused - kept for future use)
 */
/*
const ChannelItem = ({
  channel,
  isActive,
  onClick,
  isCollapsed,
}: {
  channel: (typeof MOCK_CHANNELS)[0];
  isActive: boolean;
  onClick: () => void;
  isCollapsed: boolean;
}) => {
  const Icon = channel.isPrivate ? Lock : Hash;

  if (isCollapsed) {
    return (
      <button
        onClick={onClick}
        className={clsx(
          "flex items-center justify-center w-10 h-10 rounded-xl transition-all mx-auto mb-2",
          isActive
            ? "bg-[#E3E4E8] text-blue-600"
            : "text-gray-500 hover:bg-[#EBECEF] hover:text-gray-900",
        )}
        title={channel.name}
      >
        <Icon size={16} className="opacity-60" />
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
          : "text-gray-600 hover:bg-[#EBECEF] hover:text-gray-900",
      )}
    >
      <Icon size={14} className="mr-2.5 opacity-60" />
      <span className="truncate">{channel.name}</span>
    </button>
  );
};
*/

/**
 * DMItem Component (unused - kept for future use)
 */
/*
const DMItem = ({
  employee,
  isActive,
  onClick,
  isCollapsed,
}: {
  employee: (typeof MOCK_EMPLOYEES)[0];
  isActive: boolean;
  onClick: () => void;
  isCollapsed: boolean;
}) => {
  const statusColor =
    employee.status === "online"
      ? "bg-green-500"
      : employee.status === "busy"
        ? "bg-red-500"
        : "bg-gray-400";

  if (isCollapsed) {
    return (
      <button
        onClick={onClick}
        className={clsx(
          "flex items-center justify-center w-10 h-10 rounded-xl transition-all mx-auto mb-2 relative",
          isActive
            ? "bg-[#E3E4E8] text-blue-600"
            : "text-gray-500 hover:bg-[#EBECEF] hover:text-gray-900",
        )}
        title={employee.name}
      >
        <div className="relative">
          <img
            src={employee.avatar}
            className="w-6 h-6 rounded-full object-cover shadow-sm"
            alt={employee.name}
          />
          <div
            className={clsx(
              "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white",
              statusColor,
            )}
          />
        </div>
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
          : "text-gray-600 hover:bg-[#EBECEF] hover:text-gray-900",
      )}
    >
      <div className="relative mr-2.5">
        <img
          src={employee.avatar}
          className="w-4 h-4 rounded-full object-cover shadow-sm"
          alt={employee.name}
        />
        <div
          className={clsx(
            "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white",
            statusColor,
          )}
        />
      </div>
      <span className="truncate">{employee.name}</span>
    </button>
  );
};
*/

/**
 * Task Status Config
 */
const taskStatusConfig: Record<
  TaskStatus,
  { color: string; icon: typeof CheckCircle; label: string }
> = {
  PENDING: { color: "bg-gray-400", icon: Clock, label: "Pending" },
  RUNNING: { color: "bg-blue-500", icon: Loader2, label: "Running" },
  PAUSED_FOR_HITL: {
    color: "bg-amber-500",
    icon: AlertTriangle,
    label: "Review",
  },
  COMPLETED: { color: "bg-green-500", icon: CheckCircle, label: "Done" },
  FAILED: { color: "bg-red-500", icon: AlertTriangle, label: "Failed" },
};

/**
 * TaskItem Component
 * Task navigation item with status indicator
 */
const TaskItem = ({
  task,
  isActive,
  onClick,
  isCollapsed,
}: {
  task: DAGTask;
  isActive: boolean;
  onClick: () => void;
  isCollapsed: boolean;
}) => {
  const config = taskStatusConfig[task.status];
  const Icon = config.icon;
  const truncatedPrompt =
    task.prompt.length > 20 ? task.prompt.slice(0, 20) + "..." : task.prompt;

  if (isCollapsed) {
    return (
      <button
        onClick={onClick}
        className={clsx(
          "flex items-center justify-center w-10 h-10 rounded-xl transition-all mx-auto mb-2 relative",
          isActive
            ? "bg-[#E3E4E8] text-blue-600"
            : "text-gray-500 hover:bg-[#EBECEF] hover:text-gray-900",
        )}
        title={task.prompt}
      >
        <div className={clsx("w-2 h-2 rounded-full", config.color)} />
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
          : "text-gray-600 hover:bg-[#EBECEF] hover:text-gray-900",
      )}
    >
      <div
        className={clsx(
          "w-2 h-2 rounded-full mr-2.5 shrink-0",
          config.color,
          task.status === "RUNNING" && "animate-pulse",
        )}
      />
      <Icon
        size={12}
        className={clsx(
          "mr-2 text-gray-400 shrink-0",
          task.status === "RUNNING" && "animate-spin",
        )}
      />
      <span className="truncate">{truncatedPrompt}</span>
    </button>
  );
};

/**
 * Main Sidebar Component
 *
 * macOS-style navigation sidebar supporting expanded and collapsed states.
 * Includes main navigation, channels, direct messages, and traffic lights.
 *
 * @example
 * ```tsx
 * const [sidebarState, setSidebarState] = useState<SidebarState>('expanded');
 * <Sidebar
 *   state={sidebarState}
 *   onStateChange={setSidebarState}
 *   activeTaskCount={1}
 * />
 * ```
 */
export const Sidebar = ({
  state,
  onStateChange,
  activeTaskCount = 0,
}: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [channelsOpen, setChannelsOpen] = useState(true);
  const { tasks, fetchTasks, setActiveTask } = useTaskStore();

  const isCollapsed = state === "collapsed";

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  /**
   * Handle navigation item click
   * Maps NavigationItem to appropriate route
   */
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
        case "settings":
          navigate("/settings");
          break;
      }
    } else if (navItem.type === "task") {
      setActiveTask(navItem.id);
      navigate(`/copilot/${navItem.id}`);
    }
  };

  /**
   * Determine if a navigation item is currently active
   */
  const isNavActive = (navItem: NavigationItem): boolean => {
    if (navItem.type === "view") {
      const pathMap: Record<string, string> = {
        home: "/",
        workflows: "/workflows",
        assets: "/assets",
        directory: "/employees",
        settings: "/settings",
      };
      return location.pathname === pathMap[navItem.id];
    }
    if (navItem.type === "channel" || navItem.type === "dm") {
      return location.pathname === `/chat/${navItem.type}/${navItem.id}`;
    }
    if (navItem.type === "task") {
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
        isCollapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      {/* Title Bar / Traffic Lights Area */}
      <div
        className={clsx(
          "h-12 flex items-center flex-shrink-0 drag-region select-none",
          isCollapsed ? "justify-center px-2" : "px-5 pt-2",
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

      {/* Scrollable Navigation Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {/* Main Navigation */}
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
            icon={Settings}
            label="Settings"
            isActive={isNavActive({ type: "view", id: "settings" })}
            onClick={() => handleNavClick({ type: "view", id: "settings" })}
            isCollapsed={isCollapsed}
          />
        </nav>

        {/* Channels Section */}
        <SectionHeader
          title="Chats"
          isOpen={channelsOpen}
          onClick={() => setChannelsOpen(!channelsOpen)}
          actionIcon={
            !isCollapsed && (
              <Plus
                size={12}
                className="cursor-pointer hover:text-gray-800 text-gray-400"
              />
            )
          }
          isCollapsed={isCollapsed}
        />

        {channelsOpen && (
          <div className="space-y-0.5">
            {!isCollapsed && (
              <button className="flex items-center w-full px-2.5 py-1.5 rounded-md text-[13px] font-medium cursor-pointer transition-all select-none mb-0.5 text-gray-600 hover:bg-[#EBECEF] hover:text-gray-900">
                <div className="w-4 h-4 rounded bg-gray-200 flex items-center justify-center mr-2.5">
                  <Plus size={10} className="text-gray-600" />
                </div>
                <span>New Chat</span>
              </button>
            )}

            {/* Tasks Section */}
            {tasks.length > 0 && !isCollapsed && (
              <>
                <button className="flex items-center w-full px-2.5 py-1.5 rounded-md text-[13px] font-medium cursor-pointer transition-all select-none mb-0.5 text-gray-600 hover:bg-[#EBECEF] hover:text-gray-900">
                  <div className="w-4 h-4 rounded bg-gray-200 flex items-center justify-center mr-2.5">
                    <Plus size={10} className="text-gray-600" />
                  </div>
                  <span>New Task</span>
                </button>
                {tasks.map((task) => (
                  <TaskItem
                    key={task.task_id}
                    task={task}
                    isActive={isNavActive({ type: "task", id: task.task_id })}
                    onClick={() =>
                      handleNavClick({ type: "task", id: task.task_id })
                    }
                    isCollapsed={isCollapsed}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
