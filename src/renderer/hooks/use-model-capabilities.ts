import { useCallback, useEffect, useState } from "react";
import type { ModelCapabilities } from "../../shared/ipc";

type UseModelCapabilitiesResult = {
  profileId?: string;
  capabilities: ModelCapabilities | null;
  supportsThinking: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

export const useModelCapabilities = (
  requestedProfileId?: string
): UseModelCapabilitiesResult => {
  const [profileId, setProfileId] = useState<string | undefined>(undefined);
  const [capabilities, setCapabilities] = useState<ModelCapabilities | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await window.api.getConfigSummary();
      const resolvedProfileId =
        requestedProfileId?.trim() ||
        summary.routing["chat.default"]?.trim() ||
        undefined;
      const profile = resolvedProfileId
        ? summary.modelProfiles.find((item) => item.id === resolvedProfileId)
        : undefined;
      setProfileId(resolvedProfileId);
      setCapabilities(profile?.capabilities ?? null);
    } catch {
      setProfileId(requestedProfileId?.trim() || undefined);
      setCapabilities(null);
    } finally {
      setLoading(false);
    }
  }, [requestedProfileId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    profileId,
    capabilities,
    supportsThinking: Boolean(capabilities?.supportsThinking),
    loading,
    refresh
  };
};
