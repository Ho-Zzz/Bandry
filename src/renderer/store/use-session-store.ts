import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatSession {
  id: string;
  title: string;
  agentId: string;
  lastMessage?: string;
  updatedAt: number;
  unreadCount: number;
  pinned: boolean;
}

interface SessionState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  
  // Actions
  createSession: (agentId: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  pinSession: (id: string, pinned: boolean) => void;
  updateSession: (id: string, updates: Partial<ChatSession>) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessions: [],
      activeSessionId: null,

      createSession: (agentId) => {
        const id = crypto.randomUUID();
        const newSession: ChatSession = {
          id,
          title: 'New Chat',
          agentId,
          updatedAt: Date.now(),
          unreadCount: 0,
          pinned: false,
        };
        set((state) => ({
          sessions: [newSession, ...state.sessions],
          activeSessionId: id,
        }));
        return id;
      },

      deleteSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
        }));
      },

      setActiveSession: (id) => set({ activeSessionId: id }),

      pinSession: (id, pinned) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, pinned } : s
          ),
        }));
      },

      updateSession: (id, updates) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
          ),
        }));
      },
    }),
    {
      name: 'session-storage',
    }
  )
);
