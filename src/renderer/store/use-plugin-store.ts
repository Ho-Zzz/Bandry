import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  icon?: string;
  capabilities: string[];
}

export interface AgentManifest {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  systemPrompt: string;
  defaultPlugins: string[];
}

interface PluginState {
  installedPlugins: PluginManifest[];
  enabledPlugins: string[]; // Plugin IDs
  agents: AgentManifest[];
  
  // Actions
  registerPlugin: (plugin: PluginManifest) => void;
  togglePlugin: (id: string, enabled: boolean) => void;
  registerAgent: (agent: AgentManifest) => void;
}

export const usePluginStore = create<PluginState>()(
  persist(
    (set) => ({
      installedPlugins: [],
      enabledPlugins: [],
      agents: [],

      registerPlugin: (plugin) =>
        set((state) => {
          if (state.installedPlugins.find((p) => p.id === plugin.id)) return state;
          return { installedPlugins: [...state.installedPlugins, plugin] };
        }),

      togglePlugin: (id, enabled) =>
        set((state) => {
          if (enabled) {
            return { enabledPlugins: [...state.enabledPlugins, id] };
          } else {
            return { enabledPlugins: state.enabledPlugins.filter((p) => p !== id) };
          }
        }),

      registerAgent: (agent) =>
        set((state) => {
          if (state.agents.find((a) => a.id === agent.id)) return state;
          return { agents: [...state.agents, agent] };
        }),
    }),
    {
      name: 'plugin-storage',
    }
  )
);
