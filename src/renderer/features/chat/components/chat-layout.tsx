import { Outlet } from "react-router-dom";
import { SessionList } from "./session-list";

export const ChatLayout = () => {
  return (
    <div className="flex h-full w-full">
      {/* Left Sidebar: Session List */}
      <SessionList />
      
      {/* Right Content: Chat Interface */}
      <div className="flex-1 h-full bg-white relative flex flex-col min-w-0">
        <Outlet />
      </div>
    </div>
  );
};
