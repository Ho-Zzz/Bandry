import { resolveModelTarget, type AppConfig, type RuntimeRole } from "../config";
import type { GenerateTextInput } from "./types";

export type RuntimeModelTarget = ReturnType<typeof resolveModelTarget> & {
  runtimeConfig: NonNullable<GenerateTextInput["runtimeConfig"]>;
};

export const resolveRuntimeTarget = (
  config: AppConfig,
  role: RuntimeRole,
  overrideProfileId?: string
): RuntimeModelTarget => {
  const target = resolveModelTarget(config, role, overrideProfileId);
  const providerConfig = config.providers[target.provider];

  return {
    ...target,
    runtimeConfig: {
      provider: target.provider,
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
      orgId: providerConfig.orgId
    }
  };
};
