/**
 * Conversation Store
 *
 * Zustand store for managing conversation list state.
 * Persists conversations to SQLite via IPC.
 */

import { create } from "zustand";
import type { ConversationResult } from "../../shared/ipc";

interface ConversationState {
  conversations: ConversationResult[];
  activeConversationId: string | null;
  loading: boolean;

  fetchConversations: () => Promise<void>;
  createConversation: (title?: string, modelProfileId?: string) => Promise<ConversationResult>;
  deleteConversation: (id: string) => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  updateConversationTitle: (id: string, title: string) => Promise<void>;
  updateConversationModelProfile: (id: string, modelProfileId?: string) => Promise<void>;
  getConversation: (id: string) => ConversationResult | undefined;
  upsertConversation: (conversation: ConversationResult) => void;
}

export const useConversationStore = create<ConversationState>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  loading: false,

  fetchConversations: async () => {
    set({ loading: true });
    try {
      const conversations = await window.api.conversationList();
      set({ conversations, loading: false });
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      set({ loading: false });
    }
  },

  createConversation: async (title?: string, modelProfileId?: string) => {
    const conversation = await window.api.conversationCreate({
      title,
      model_profile_id: modelProfileId
    });
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: conversation.id
    }));
    return conversation;
  },

  deleteConversation: async (id: string) => {
    await window.api.conversationDelete(id);
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeConversationId: state.activeConversationId === id ? null : state.activeConversationId
    }));
  },

  setActiveConversation: (id: string | null) => {
    set({ activeConversationId: id });
  },

  updateConversationTitle: async (id: string, title: string) => {
    const updated = await window.api.conversationUpdate(id, { title });
    if (updated) {
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, title, updated_at: updated.updated_at } : c
        )
      }));
    }
  },

  updateConversationModelProfile: async (id: string, modelProfileId?: string) => {
    const updated = await window.api.conversationUpdate(id, {
      model_profile_id: modelProfileId
    });

    if (updated) {
      set((state) => ({
        conversations: state.conversations.map((conversation) =>
          conversation.id === id
            ? {
                ...conversation,
                model_profile_id: updated.model_profile_id,
                updated_at: updated.updated_at
              }
            : conversation
        )
      }));
    }
  },

  getConversation: (id: string) => {
    return get().conversations.find((c) => c.id === id);
  },

  upsertConversation: (conversation: ConversationResult) => {
    set((state) => {
      const index = state.conversations.findIndex((item) => item.id === conversation.id);
      if (index === -1) {
        return {
          conversations: [conversation, ...state.conversations]
        };
      }

      const next = [...state.conversations];
      next[index] = {
        ...next[index],
        ...conversation
      };
      return {
        conversations: next
      };
    });
  }
}));
