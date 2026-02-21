import type { AppConfig, LlmProvider, RuntimeRole } from "./types";

export type ResolvedModelTarget = {
  role: RuntimeRole;
  profileId: string;
  provider: LlmProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
};

const isProviderRuntimeUsable = (config: AppConfig, provider: LlmProvider): boolean => {
  const providerConfig = config.providers[provider];
  return providerConfig.enabled && providerConfig.apiKey.trim().length > 0;
};

const resolveUsableProfile = (config: AppConfig, profileId: string | undefined): AppConfig["modelProfiles"][number] | undefined => {
  if (!profileId) {
    return undefined;
  }
  const profile = config.modelProfiles.find((item) => item.id === profileId && item.enabled);
  if (!profile) {
    return undefined;
  }
  if (!isProviderRuntimeUsable(config, profile.provider)) {
    return undefined;
  }
  return profile;
};

const resolveFallbackProfile = (config: AppConfig): AppConfig["modelProfiles"][number] => {
  const enabledUsable = config.modelProfiles.find((profile) => {
    return profile.enabled && isProviderRuntimeUsable(config, profile.provider);
  });
  if (enabledUsable) {
    return enabledUsable;
  }

  const usableByProvider = config.modelProfiles.find((profile) => profile.provider === config.llm.defaultProvider && profile.enabled);
  if (usableByProvider) {
    return usableByProvider;
  }

  const first = config.modelProfiles[0];
  if (first) {
    return first;
  }

  return {
    id: "profile_fallback_openai",
    name: "Fallback OpenAI",
    provider: "openai",
    model: config.providers.openai.model,
    enabled: true
  };
};

export const resolveModelTarget = (
  config: AppConfig,
  role: RuntimeRole,
  overrideProfileId?: string
): ResolvedModelTarget => {
  const fromOverride = resolveUsableProfile(config, overrideProfileId);
  if (fromOverride) {
    return {
      role,
      profileId: fromOverride.id,
      provider: fromOverride.provider,
      model: fromOverride.model,
      temperature: fromOverride.temperature,
      maxTokens: fromOverride.maxTokens
    };
  }

  const assigned = config.routing.assignments[role];
  const fromAssignment = resolveUsableProfile(config, assigned);
  if (fromAssignment) {
    return {
      role,
      profileId: fromAssignment.id,
      provider: fromAssignment.provider,
      model: fromAssignment.model,
      temperature: fromAssignment.temperature,
      maxTokens: fromAssignment.maxTokens
    };
  }

  const fallback = resolveFallbackProfile(config);
  return {
    role,
    profileId: fallback.id,
    provider: fallback.provider,
    model: fallback.model,
    temperature: fallback.temperature,
    maxTokens: fallback.maxTokens
  };
};
