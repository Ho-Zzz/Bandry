/**
 * App Layout Component
 * 
 * Main application layout with macOS-style sidebar and content area.
 * Features a resizable sidebar that can be expanded or collapsed.
 */

import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Search, Bell } from 'lucide-react';
import { Sidebar } from './sidebar';
import type { SidebarState } from '../../types/app';

/**
 * Header Component
 * macOS-style toolbar with search bar and user controls
 */
const Header = () => (
  <header className="h-12 border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-10">
    {/* Search Bar */}
    <div className="flex-1 max-w-md">
      <div className="relative group">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"
        />
        <input
          type="text"
          placeholder="Search"
          className="w-full bg-gray-100/50 border border-transparent text-[13px] text-gray-900 rounded-md pl-8 pr-4 py-1 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all placeholder-gray-400 font-medium"
        />
      </div>
    </div>

    {/* Right Actions */}
    <div className="flex items-center space-x-5 ml-4">
      <button className="text-gray-400 hover:text-gray-600 transition-colors relative">
        <Bell size={18} />
        <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white" />
      </button>
      <div className="w-7 h-7 rounded-full bg-gradient-to-b from-gray-200 to-gray-300 border border-gray-300 shadow-inner overflow-hidden">
        <img
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=User"
          alt="User"
          className="w-full h-full object-cover opacity-90"
        />
      </div>
    </div>
  </header>
);

/**
 * AppLayout Component
 * 
 * Main layout wrapper that provides the sidebar and main content area.
 * Manages sidebar state (expanded/collapsed) and renders the current route.
 * 
 * @example
 * ```tsx
 * <Routes>
 *   <Route element={<AppLayout />}>
 *     <Route path="/" element={<Home />} />
 *   </Route>
 * </Routes>
 * ```
 */
export const AppLayout = () => {
  // Sidebar state management
  const [sidebarState, setSidebarState] = useState<SidebarState>('expanded');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-gray-900 font-sans">
      {/* Sidebar - macOS style with expand/collapse */}
      <Sidebar
        state={sidebarState}
        onStateChange={setSidebarState}
        activeTaskCount={0}
      />

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-hidden relative flex flex-col bg-white">
        <Header />
        <div className="flex-1 overflow-y-auto relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
