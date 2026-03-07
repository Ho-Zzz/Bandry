import type { AppConfig, ModelCapabilities, ModelProfile } from "../../config";
import type { ModelsFactory } from "../../llm/runtime";
import type { MemoryProvider } from "../../memory/contracts/types";
import type { ConversationStore } from "../../persistence/sqlite";
import type { SandboxService } from "../../sandbox";
import type { ChatMode } from "../../../shared/ipc";
import { ToolPlanningChatAgent } from "./planner-chat-agent";

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export type ApiExtras = {
  extraBody?: Record<string, unknown>;
  reasoningEffort?: ReasoningEffort;
};

export type CreateAgentParams = {
  conversationId?: string;
  modelProfileId?: string;
  mode?: ChatMode;
  thinkingEnabled?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export type AgentContext = {
  modelProfileId?: string;
  modelCapabilities?: ModelCapabilities;
  thinkingEnabled: boolean;
  apiExtras: ApiExtras;
  warnings: string[];
  memoryProvider?: MemoryProvider;
};

export type CreateAgentResult = {
  agent: ToolPlanningChatAgent;
  context: AgentContext;
};

export type ChatAgentFactoryDeps = {
  config: AppConfig;
  modelsFactory: ModelsFactory;
  sandboxService: SandboxService;
  conversationStore: ConversationStore;
  getMemoryProvider?: () => MemoryProvider | null | undefined;
};

const OPENAI_EXTRA_BODY_WHITELIST = new Set([
  "logitBias",
  "logprobs",
  "parallelToolCalls",
  "user",
  "reasoningEffort",
  "maxCompletionTokens",
  "store",
  "metadata",
  "prediction",
  "serviceTier",
  "strictJsonSchema",
  "textVerbosity",
  "promptCacheKey",
  "promptCacheRetention",
  "safetyIdentifier",
  "systemMessageMode",
  "forceReasoning"
]);

export class ChatAgentFactory {
  constructor(private readonly deps: ChatAgentFactoryDeps) {}

  createAgent(params: CreateAgentParams): CreateAgentResult {
    const context = this.createContext(params);

    return {
      agent: new ToolPlanningChatAgent(
        this.deps.config,
        this.deps.modelsFactory,
        this.deps.sandboxService,
        this.deps.conversationStore
      ),
      context
    };
  }

  createContext(params: CreateAgentParams): AgentContext {
    const warnings: string[] = [];
    const modelProfileId = this.resolveModelProfileId(params);
    const modelProfile = modelProfileId
      ? this.resolveModelProfile(modelProfileId)
      : undefined;

    if (modelProfileId && !modelProfile) {
      warnings.push(`Model profile "${modelProfileId}" was not found or disabled. Falling back to runtime routing.`);
    }

    const capabilities = modelProfile?.capabilities;
    const thinkingEnabled = params.mode === "thinking"
      ? true
      : params.thinkingEnabled ?? Boolean(capabilities?.supportsThinking);

    const { apiExtras, warnings: apiWarnings } = this.buildApiExtras(
      modelProfile,
      thinkingEnabled,
      params.reasoningEffort
    );
    warnings.push(...apiWarnings);

    return {
      modelProfileId: modelProfile?.id,
      modelCapabilities: capabilities,
      thinkingEnabled,
      apiExtras,
      warnings,
      memoryProvider: this.deps.getMemoryProvider?.() ?? undefined
    };
  }

  private resolveModelProfileId(params: CreateAgentParams): string | undefined {
    const explicitId = params.modelProfileId?.trim();
    if (explicitId) {
      return explicitId;
    }

    const conversationId = params.conversationId?.trim();
    if (conversationId) {
      const conversation = this.deps.conversationStore.getConversation(conversationId);
      const conversationModelProfileId = conversation?.model_profile_id?.trim();
      if (conversationModelProfileId) {
        return conversationModelProfileId;
      }
    }

    return (
      this.deps.config.routing.assignments["lead.planner"]?.trim() ||
      this.deps.config.routing.assignments["chat.default"]?.trim() ||
      undefined
    );
  }

  private resolveModelProfile(profileId: string): ModelProfile | undefined {
    const profile = this.deps.config.modelProfiles.find(
      (item) => item.id === profileId
    );
    if (!profile || profile.enabled === false) {
      return undefined;
    }
    return profile;
  }

  private buildApiExtras(
    modelProfile: ModelProfile | undefined,
    thinkingEnabled: boolean,
    requestedReasoningEffort: ReasoningEffort | undefined
  ): { apiExtras: ApiExtras; warnings: string[] } {
    const apiExtras: ApiExtras = {};
    const warnings: string[] = [];
    const capabilities = modelProfile?.capabilities;
    const provider = modelProfile?.provider;

    if (thinkingEnabled) {
      if (capabilities?.supportsThinking) {
        const configured = modelProfile?.whenThinkingEnabled;
        if (configured?.extraBody) {
          const { filtered, droppedKeys } = this.filterExtraBody(configured.extraBody, provider);
          if (Object.keys(filtered).length > 0) {
            apiExtras.extraBody = filtered;
          }
          if (droppedKeys.length > 0) {
            warnings.push(`Dropped unsupported thinking extraBody keys: ${droppedKeys.join(", ")}`);
          }
        }

        if (
          configured?.reasoningEffort &&
          capabilities.supportsReasoningEffort !== false
        ) {
          apiExtras.reasoningEffort = configured.reasoningEffort;
        }
      } else {
        warnings.push("Thinking is enabled but the selected model does not declare thinking support. Running best-effort.");
      }
    } else if (capabilities?.supportsThinking) {
      const { filtered, droppedKeys } = this.filterExtraBody(
        {
          thinking: { type: "disabled" }
        },
        provider
      );
      if (Object.keys(filtered).length > 0) {
        apiExtras.extraBody = filtered;
      }
      if (droppedKeys.length > 0) {
        warnings.push(`Dropped unsupported disable-thinking extraBody keys: ${droppedKeys.join(", ")}`);
      }

      if (capabilities.supportsReasoningEffort !== false) {
        apiExtras.reasoningEffort = "minimal";
      }
    }

    if (requestedReasoningEffort !== undefined) {
      if (capabilities?.supportsReasoningEffort === false) {
        warnings.push("reasoningEffort is ignored because the selected model does not support reasoning effort.");
      } else {
        apiExtras.reasoningEffort = requestedReasoningEffort;
      }
    }

    return { apiExtras, warnings };
  }

  private filterExtraBody(
    extraBody: Record<string, unknown>,
    provider: AppConfig["modelProfiles"][number]["provider"] | undefined
  ): { filtered: Record<string, unknown>; droppedKeys: string[] } {
    const filtered: Record<string, unknown> = {};
    const droppedKeys: string[] = [];

    if (!provider) {
      return {
        filtered,
        droppedKeys: Object.keys(extraBody)
      };
    }

    for (const [rawKey, value] of Object.entries(extraBody)) {
      const key = rawKey === "reasoning_effort" ? "reasoningEffort" : rawKey;
      if (OPENAI_EXTRA_BODY_WHITELIST.has(key)) {
        filtered[key] = value;
      } else {
        droppedKeys.push(rawKey);
      }
    }

    return { filtered, droppedKeys };
  }
}
