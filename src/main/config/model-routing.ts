import type { AppConfig, LlmProvider, RuntimeRole } from "./types";
import { hasUsableProviderApiKey } from "./provider-credential";

export type ResolvedModelTarget = {
  role: RuntimeRole;
  profileId: string;
  provider: LlmProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
};

export type ModelRoutingErrorCode =
  | "ROLE_ASSIGNMENT_MISSING"
  | "MODEL_PROFILE_NOT_FOUND"
  | "MODEL_PROFILE_DISABLED"
  | "MODEL_PROVIDER_DISABLED"
  | "MODEL_PROVIDER_UNCONFIGURED";

type ModelRoutingErrorInput = {
  code: ModelRoutingErrorCode;
  role: RuntimeRole;
  profileId?: string;
  provider?: LlmProvider;
  source: "assignment" | "override";
};

const buildModelRoutingErrorMessage = (input: ModelRoutingErrorInput): string => {
  const sourceLabel = input.source === "override" ? "override profile" : "assigned profile";
  if (input.code === "ROLE_ASSIGNMENT_MISSING") {
    return `[${input.role}] has no ${sourceLabel}. Please bind a model profile in People / Model Studio.`;
  }
  if (input.code === "MODEL_PROFILE_NOT_FOUND") {
    return `[${input.role}] ${sourceLabel} "${input.profileId ?? ""}" was not found.`;
  }
  if (input.code === "MODEL_PROFILE_DISABLED") {
    return `[${input.role}] ${sourceLabel} "${input.profileId ?? ""}" is disabled.`;
  }
  if (input.code === "MODEL_PROVIDER_DISABLED") {
    return `[${input.role}] provider "${input.provider ?? ""}" for profile "${input.profileId ?? ""}" is disabled.`;
  }

  return `[${input.role}] provider "${input.provider ?? ""}" for profile "${input.profileId ?? ""}" has missing or invalid API key.`;
};

export class ModelRoutingError extends Error {
  readonly code: ModelRoutingErrorCode;
  readonly role: RuntimeRole;
  readonly profileId?: string;
  readonly provider?: LlmProvider;
  readonly source: "assignment" | "override";

  constructor(input: ModelRoutingErrorInput) {
    super(buildModelRoutingErrorMessage(input));
    this.name = "ModelRoutingError";
    this.code = input.code;
    this.role = input.role;
    this.profileId = input.profileId;
    this.provider = input.provider;
    this.source = input.source;
  }
}

const isProviderRuntimeUsable = (config: AppConfig, provider: LlmProvider): boolean => {
  const providerConfig = config.providers[provider];
  return providerConfig.enabled && hasUsableProviderApiKey(provider, providerConfig.apiKey);
};

const resolveStrictProfile = (
  config: AppConfig,
  role: RuntimeRole,
  source: "assignment" | "override",
  profileId: string | undefined
): AppConfig["modelProfiles"][number] => {
  const normalizedProfileId = profileId?.trim();
  if (!normalizedProfileId) {
    throw new ModelRoutingError({
      code: "ROLE_ASSIGNMENT_MISSING",
      role,
      source
    });
  }

  const profile = config.modelProfiles.find((item) => item.id === normalizedProfileId);
  if (!profile) {
    throw new ModelRoutingError({
      code: "MODEL_PROFILE_NOT_FOUND",
      role,
      profileId: normalizedProfileId,
      source
    });
  }

  if (!profile.enabled) {
    throw new ModelRoutingError({
      code: "MODEL_PROFILE_DISABLED",
      role,
      profileId: profile.id,
      provider: profile.provider,
      source
    });
  }

  const providerConfig = config.providers[profile.provider];
  if (!providerConfig.enabled) {
    throw new ModelRoutingError({
      code: "MODEL_PROVIDER_DISABLED",
      role,
      profileId: profile.id,
      provider: profile.provider,
      source
    });
  }

  if (!isProviderRuntimeUsable(config, profile.provider)) {
    throw new ModelRoutingError({
      code: "MODEL_PROVIDER_UNCONFIGURED",
      role,
      profileId: profile.id,
      provider: profile.provider,
      source
    });
  }

  return profile;
};

export const resolveModelTarget = (
  config: AppConfig,
  role: RuntimeRole,
  overrideProfileId?: string
): ResolvedModelTarget => {
  const profile = overrideProfileId
    ? resolveStrictProfile(config, role, "override", overrideProfileId)
    : resolveStrictProfile(config, role, "assignment", config.routing.assignments[role]);

  return {
    role,
    profileId: profile.id,
    provider: profile.provider,
    model: profile.model,
    temperature: profile.temperature,
    maxTokens: profile.maxTokens
  };
};
