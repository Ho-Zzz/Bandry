import type {
  ConnectedModelResult,
  ModelsCatalogListInput,
  ModelsCatalogListResult,
  ModelsConnectInput,
  ModelsConnectResult,
  ModelsListConnectedResult,
  ModelsOperationResult,
  ModelsRemoveInput,
  ModelsSetDefaultInput,
  ModelsUpdateCredentialInput,
  SettingsRuntimeRole
} from "../../shared/ipc";
import type { ModelProvider } from "../../shared/ipc";
import { MODEL_PROVIDER_NAME_MAP } from "../../shared/model-providers";
import { ModelsCatalogService } from "../llm";
import { hasUsableProviderApiKey } from "../config/provider-credential";
import { SettingsService } from "./settings-service";

const RUNTIME_ROLES: SettingsRuntimeRole[] = [
  "chat.default",
  "lead.planner",
  "lead.synthesizer",
  "sub.researcher",
  "sub.bash_operator",
  "sub.writer",
  "memory.fact_extractor"
];

const toProviderDisplayName = (provider: ModelProvider): string => {
  return MODEL_PROVIDER_NAME_MAP[provider] ?? provider;
};

const toSlug = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const buildProfileId = (
  existingIds: Set<string>,
  provider: ModelProvider,
  modelId: string
): string => {
  const modelSlug = toSlug(modelId) || "model";
  const base = `profile_${provider}_${modelSlug}`;
  if (!existingIds.has(base)) {
    return base;
  }

  for (let suffix = 2; suffix <= 9999; suffix += 1) {
    const candidate = `${base}_${suffix}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }

  return `${base}_${Date.now()}`;
};

export class ModelOnboardingService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly catalogService: ModelsCatalogService
  ) {}

  async listCatalog(input: ModelsCatalogListInput = {}): Promise<ModelsCatalogListResult> {
    return this.catalogService.list(input);
  }

  listConnected(): ModelsListConnectedResult {
    const state = this.settingsService.getState();
    const chatDefaultProfileId = state.routing["chat.default"];
    const models: ConnectedModelResult[] = state.modelProfiles
      .map((profile) => {
        const providerConfigured = hasUsableProviderApiKey(
          profile.provider,
          state.providers[profile.provider].apiKey
        );
        return {
          profileId: profile.id,
          profileName: profile.name,
          provider: profile.provider,
          providerName: toProviderDisplayName(profile.provider),
          model: profile.model,
          enabled: profile.enabled,
          isChatDefault: profile.id === chatDefaultProfileId,
          providerConfigured
        };
      })
      .sort((a, b) => a.profileName.localeCompare(b.profileName));

    return {
      chatDefaultProfileId,
      models
    };
  }

  async connect(input: ModelsConnectInput): Promise<ModelsConnectResult> {
    const modelId = input.modelId.trim();
    if (!modelId) {
      throw new Error("modelId is required");
    }
    const apiKey = input.apiKey.trim();
    if (!apiKey) {
      throw new Error("apiKey is required");
    }

    const catalog = await this.catalogService.list();
    const providerCatalog = catalog.providers.find((provider) => provider.id === input.provider);
    if (!providerCatalog) {
      throw new Error(`Provider ${input.provider} is not available in current catalog source`);
    }

    const catalogModel = providerCatalog.models.find((item) => item.id === modelId);
    if (!catalogModel) {
      throw new Error(`Model ${input.provider}/${modelId} is not available in current catalog source`);
    }

    const next = this.settingsService.getState();
    const duplicated = next.modelProfiles.find(
      (profile) => profile.provider === input.provider && profile.model === modelId
    );
    if (duplicated) {
      throw new Error(`Model ${input.provider}/${modelId} is already connected`);
    }

    const providerConfig = next.providers[input.provider];
    providerConfig.apiKey = apiKey;
    providerConfig.enabled = true;
    const incomingBaseUrl = input.baseUrl?.trim();
    if (incomingBaseUrl) {
      providerConfig.baseUrl = incomingBaseUrl;
    }

    const existingIds = new Set(next.modelProfiles.map((profile) => profile.id));
    const profileId = buildProfileId(existingIds, input.provider, modelId);
    const profileName = `${providerCatalog.name} / ${catalogModel.name}`;

    next.modelProfiles.push({
      id: profileId,
      name: profileName,
      provider: input.provider,
      model: modelId,
      enabled: true,
      temperature: 0.2
    });

    const saveResult = await this.settingsService.saveState({
      state: next
    });
    if (!saveResult.ok) {
      throw new Error(saveResult.message);
    }

    const connected = this.listConnected().models.find((item) => item.profileId === profileId);
    if (!connected) {
      throw new Error("Connected model profile not found after save");
    }

    return {
      ok: true,
      message: "Model connected successfully",
      requiresRestart: saveResult.requiresRestart,
      profile: connected
    };
  }

  async setChatDefault(input: ModelsSetDefaultInput): Promise<ModelsOperationResult> {
    const profileId = input.profileId.trim();
    if (!profileId) {
      throw new Error("profileId is required");
    }

    const next = this.settingsService.getState();
    const target = next.modelProfiles.find((profile) => profile.id === profileId);
    if (!target) {
      throw new Error(`Model profile not found: ${profileId}`);
    }

    next.routing["chat.default"] = target.id;
    const saveResult = await this.settingsService.saveState({
      state: next
    });
    if (!saveResult.ok) {
      throw new Error(saveResult.message);
    }

    return {
      ok: true,
      message: "Chat default model updated",
      requiresRestart: saveResult.requiresRestart
    };
  }

  async remove(input: ModelsRemoveInput): Promise<ModelsOperationResult> {
    const profileId = input.profileId.trim();
    if (!profileId) {
      throw new Error("profileId is required");
    }

    const next = this.settingsService.getState();
    const target = next.modelProfiles.find((profile) => profile.id === profileId);
    if (!target) {
      throw new Error(`Model profile not found: ${profileId}`);
    }

    const boundRoles = RUNTIME_ROLES.filter((role) => next.routing[role] === profileId);
    if (boundRoles.length > 0) {
      throw new Error(
        `Model profile ${profileId} is still bound to roles: ${boundRoles.join(", ")}. Rebind these roles first.`
      );
    }

    const remaining = next.modelProfiles.filter((profile) => profile.id !== profileId);
    if (remaining.length === 0) {
      throw new Error("At least one model profile must remain");
    }

    const enabledRemaining = remaining.filter((profile) => profile.enabled);
    if (enabledRemaining.length === 0) {
      throw new Error("At least one enabled model profile must remain");
    }

    next.modelProfiles = remaining;

    const saveResult = await this.settingsService.saveState({
      state: next
    });
    if (!saveResult.ok) {
      throw new Error(saveResult.message);
    }

    return {
      ok: true,
      message: "Model profile removed",
      requiresRestart: saveResult.requiresRestart
    };
  }

  async updateProviderCredential(input: ModelsUpdateCredentialInput): Promise<ModelsOperationResult> {
    const next = this.settingsService.getState();
    const providerConfig = next.providers[input.provider];
    if (!providerConfig) {
      throw new Error(`Provider not found: ${input.provider}`);
    }

    if (input.apiKey !== undefined) {
      providerConfig.apiKey = input.apiKey.trim();
    }
    const baseUrl = input.baseUrl?.trim();
    if (baseUrl) {
      providerConfig.baseUrl = baseUrl;
    }
    if (input.provider === "openai" && input.orgId !== undefined) {
      providerConfig.orgId = input.orgId.trim();
    }

    const saveResult = await this.settingsService.saveState({
      state: next
    });
    if (!saveResult.ok) {
      throw new Error(saveResult.message);
    }

    return {
      ok: true,
      message: "Provider credential updated",
      requiresRestart: saveResult.requiresRestart
    };
  }
}
