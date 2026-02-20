import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  llm: {
    provider: 'openai' | 'anthropic' | 'deepseek' | 'local';
    apiKey?: string;
    baseUrl?: string;
    modelName?: string;
  };
  
  // Actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  updateLlmConfig: (config: Partial<SettingsState['llm']>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      llm: {
        provider: 'deepseek',
        modelName: 'deepseek-chat',
      },

      setTheme: (theme) => set({ theme }),
      
      updateLlmConfig: (config) =>
        set((state) => ({
          llm: { ...state.llm, ...config },
        })),
    }),
    {
      name: 'settings-storage',
    }
  )
);
