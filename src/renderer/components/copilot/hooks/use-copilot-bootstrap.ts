import { useCallback, useEffect, useState } from "react";

import type { MemoryStatusResult } from "../../../../shared/ipc";
import { usePreviewStore } from "../../../store/use-preview-store";

type BootstrapState = {
  profilesLoading: boolean;
  leadRouteReady: boolean;
  memoryStatus: MemoryStatusResult | null;
};

export const useCopilotBootstrap = () => {
  const setPreviewVirtualRoot = usePreviewStore((s) => s.setVirtualRoot);
  const [state, setState] = useState<BootstrapState>({
    profilesLoading: true,
    leadRouteReady: true,
    memoryStatus: null
  });

  const refreshMemoryStatus = useCallback(async () => {
    try {
      const result = await window.api.memoryStatus();
      setState((previous) => ({
        ...previous,
        memoryStatus: result
      }));
    } catch {
      setState((previous) => ({
        ...previous,
        memoryStatus: null
      }));
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setState((previous) => ({
          ...previous,
          profilesLoading: true
        }));

        const summary = await window.api.getConfigSummary();
        if (summary.sandbox?.virtualRoot) {
          setPreviewVirtualRoot(summary.sandbox.virtualRoot);
        }

        const configuredProviders = new Set(
          summary.providers
            .filter((provider) => provider.configured && provider.enabled)
            .map((provider) => provider.name)
        );

        const roleReady = (role: "lead.planner" | "lead.synthesizer"): boolean => {
          const profileId = summary.routing[role];
          const profile = summary.modelProfiles.find((item) => item.id === profileId && item.enabled);
          return Boolean(profile && configuredProviders.has(profile.provider));
        };

        setState((previous) => ({
          ...previous,
          leadRouteReady: roleReady("lead.planner") && roleReady("lead.synthesizer"),
          profilesLoading: false
        }));
      } catch {
        setState((previous) => ({
          ...previous,
          leadRouteReady: false,
          profilesLoading: false
        }));
      }
    };

    void load();
    void refreshMemoryStatus();
  }, [refreshMemoryStatus, setPreviewVirtualRoot]);

  return {
    ...state,
    refreshMemoryStatus
  };
};
