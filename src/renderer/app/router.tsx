/**
 * App Router Configuration
 * 
 * Defines all application routes with the new sidebar navigation structure.
 * Supports Home, Workflows, Assets, Employees, Copilot, and Chat views.
 */

import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/layout';
import { Home } from '../components/views/home';
import { Workflows } from '../components/views/workflows';
import { Assets } from '../components/views/assets';
import { Employees } from '../components/views/employees';
import { Chat } from '../components/views/chat';
import { Copilot } from '../components/views/copilot';
import { INITIAL_TASK } from '../data/mock';
import type { NavigationItem } from '../types/app';

/**
 * HomePage Component
 * Wrapper for Home view with required props
 */
const HomePage = () => {
  const handleReviewClick = () => {
    // TODO: Implement review modal logic
    console.log('Review clicked');
  };

  return <Home tasks={[INITIAL_TASK]} onReviewClick={handleReviewClick} />;
};

/**
 * ChatPage Component
 * Wrapper for Chat view with navigation item conversion
 */
const ChatPage = () => {
  // Extract chat type and id from URL
  const path = window.location.pathname;
  const match = path.match(/\/chat\/(channel|dm)\/(.+)/);
  
  if (!match) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2 text-gray-700">Select a conversation</h3>
          <p className="text-sm">Choose a channel or direct message from the sidebar</p>
        </div>
      </div>
    );
  }

  const [, type, id] = match;
  const activeNav: NavigationItem = {
    type: type as 'channel' | 'dm',
    id,
  };

  return <Chat activeNav={activeNav} />;
};

/**
 * AppRouter Component
 * 
 * Main application router with HashRouter for Electron file:// protocol support.
 * Defines routes for all views and handles navigation.
 * 
 * @example
 * ```tsx
 * <AppRouter />
 * ```
 */
export const AppRouter = () => {
  // Use HashRouter for file:// protocol (Electron), BrowserRouter for web
  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

  return (
    <Router>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          {/* Default redirect to home */}
          <Route index element={<HomePage />} />
          
          {/* Main Views */}
          <Route path="workflows" element={<Workflows />} />
          <Route path="assets" element={<Assets />} />
          <Route path="employees" element={<Employees />} />
          
          {/* Copilot Views */}
          <Route path="copilot" element={<Copilot />} />
          <Route path="copilot/:taskId" element={<Copilot />} />
          
          {/* Chat Views */}
          <Route path="chat" element={<ChatPage />} />
          <Route path="chat/:type/:id" element={<ChatPage />} />
          
          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
};
