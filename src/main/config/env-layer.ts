import type { ConfigLayer } from "./types";
import {
  toBooleanValue,
  toNetworkMode,
  toNumberValue,
  toStringListValue,
  toStringValue
} from "./value-parsers";

const isValidUrl = (value: string | undefined): value is string => {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  try {
    // URL parser accepts absolute URLs for provider base endpoints.
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const toBaseUrlValue = (raw: unknown): string | undefined => {
  const value = toStringValue(raw);
  if (value === undefined || value === "") {
    return value;
  }
  return isValidUrl(value) ? value : undefined;
};

export const envToLayer = (env: NodeJS.ProcessEnv): ConfigLayer => {
  type LlmLayer = NonNullable<ConfigLayer["llm"]>;
  const volcengineApiKeyRaw = toStringValue(env.BYTEDANCE_API_KEY ?? env.VOLCENGINE_API_KEY);
  const volcengineBaseUrlRaw = toStringValue(env.BYTEDANCE_BASE_URL ?? env.VOLCENGINE_BASE_URL);
  let volcengineApiKey = volcengineApiKeyRaw;
  let volcengineBaseUrl = toBaseUrlValue(volcengineBaseUrlRaw);

  // Compatibility for common misconfiguration:
  // BYTEDANCE_API_KEY was set to URL and BYTEDANCE_BASE_URL was set to key-like string.
  // In this case only repair API key; keep baseUrl undefined to avoid overriding saved Settings value.
  if (
    volcengineApiKey &&
    isValidUrl(volcengineApiKey) &&
    volcengineBaseUrlRaw &&
    !isValidUrl(volcengineBaseUrlRaw)
  ) {
    volcengineApiKey = volcengineBaseUrlRaw;
    volcengineBaseUrl = undefined;
  }

  return {
    llm: {
      defaultProvider: toStringValue(env.LLM_DEFAULT_PROVIDER) as LlmLayer["defaultProvider"] | undefined,
      defaultModel: toStringValue(env.LLM_DEFAULT_MODEL),
      timeoutMs: toNumberValue(env.LLM_TIMEOUT_MS),
      maxRetries: toNumberValue(env.LLM_MAX_RETRIES),
      retryBaseMs: toNumberValue(env.LLM_RETRY_BASE_MS),
      rateLimitRps: toNumberValue(env.LLM_RATE_LIMIT_RPS),
      networkMode: toNetworkMode(env.NETWORK_MODE),
      offlineNonModelOnly: toBooleanValue(env.OFFLINE_NON_MODEL_ONLY),
      auditLogEnabled: toBooleanValue(env.LLM_AUDIT_LOG_ENABLED),
      piiRedactionEnabled: toBooleanValue(env.PII_REDACTION_ENABLED)
    },
    sandbox: {
      virtualRoot: toStringValue(env.SANDBOX_VIRTUAL_ROOT),
      allowedWorkspaces: toStringListValue(env.SANDBOX_ALLOWED_WORKSPACES),
      allowedCommands: toStringListValue(env.SANDBOX_ALLOWED_COMMANDS),
      execTimeoutMs: toNumberValue(env.SANDBOX_EXEC_TIMEOUT_MS),
      maxOutputBytes: toNumberValue(env.SANDBOX_MAX_OUTPUT_BYTES),
      auditLogEnabled: toBooleanValue(env.SANDBOX_AUDIT_LOG_ENABLED)
    },
    features: {
      enableMemory: toBooleanValue(env.ENABLE_MEMORY),
      enableMCP: toBooleanValue(env.ENABLE_MCP)
    },
    openviking: {
      enabled: toBooleanValue(env.OPENVIKING_ENABLED),
      host: toStringValue(env.OPENVIKING_HOST),
      port: toNumberValue(env.OPENVIKING_PORT),
      apiKey: toStringValue(env.OPENVIKING_API_KEY),
      vlmProfileId: toStringValue(env.OPENVIKING_VLM_PROFILE_ID),
      embeddingProfileId: toStringValue(env.OPENVIKING_EMBEDDING_PROFILE_ID),
      serverCommand: toStringValue(env.OPENVIKING_SERVER_COMMAND),
      serverArgs: toStringListValue(env.OPENVIKING_SERVER_ARGS),
      startTimeoutMs: toNumberValue(env.OPENVIKING_START_TIMEOUT_MS),
      healthcheckIntervalMs: toNumberValue(env.OPENVIKING_HEALTHCHECK_INTERVAL_MS),
      memoryTopK: toNumberValue(env.OPENVIKING_MEMORY_TOP_K),
      memoryScoreThreshold: toNumberValue(env.OPENVIKING_MEMORY_SCORE_THRESHOLD),
      commitDebounceMs: toNumberValue(env.OPENVIKING_COMMIT_DEBOUNCE_MS),
      targetUris: toStringListValue(env.OPENVIKING_TARGET_URIS)
    },
    paths: {
      bandryHome: toStringValue(env.BANDRY_HOME),
      configDir: toStringValue(env.BANDRY_CONFIG_DIR),
      logsDir: toStringValue(env.BANDRY_LOG_DIR),
      workspaceDir: toStringValue(env.BANDRY_WORKSPACE_DIR ?? env.BANDRY_WORKSPACES_DIR),
      workspacesDir: toStringValue(env.BANDRY_WORKSPACES_DIR),
      resourcesDir: toStringValue(env.BANDRY_RESOURCES_DIR),
      pluginsDir: toStringValue(env.BANDRY_PLUGINS_DIR),
      traceDir: toStringValue(env.BANDRY_TRACE_DIR),
      databasePath: toStringValue(env.BANDRY_DB_PATH),
      auditLogPath: toStringValue(env.BANDRY_AUDIT_LOG_PATH),
      sandboxAuditLogPath: toStringValue(env.BANDRY_SANDBOX_AUDIT_LOG_PATH)
    },
    catalog: {
      source: {
        type: toStringValue(env.BANDRY_MODELS_SOURCE_TYPE) as "http" | "file" | undefined,
        location: toStringValue(env.BANDRY_MODELS_SOURCE_LOCATION),
        schema: "models.dev",
        timeoutMs: toNumberValue(env.BANDRY_MODELS_SOURCE_TIMEOUT_MS)
      }
    },
    tools: {
      webSearch: {
        enabled: toBooleanValue(env.WEB_SEARCH_ENABLED),
        provider: "tavily",
        apiKey: toStringValue(env.TAVILY_API_KEY),
        baseUrl: toBaseUrlValue(env.TAVILY_BASE_URL),
        timeoutMs: toNumberValue(env.WEB_SEARCH_TIMEOUT_MS),
        maxResults: toNumberValue(env.WEB_SEARCH_MAX_RESULTS)
      },
      webFetch: {
        enabled: toBooleanValue(env.WEB_FETCH_ENABLED),
        provider: "jina",
        apiKey: toStringValue(env.JINA_API_KEY),
        baseUrl: toBaseUrlValue(env.JINA_BASE_URL),
        timeoutMs: toNumberValue(env.WEB_FETCH_TIMEOUT_MS)
      }
    },
    channels: {
      enabled: toBooleanValue(env.CHANNELS_ENABLED),
      channels: env.FEISHU_APP_ID && env.FEISHU_APP_SECRET
        ? [{
            type: "feishu" as const,
            appId: env.FEISHU_APP_ID,
            appSecret: env.FEISHU_APP_SECRET,
            allowedChatIds: toStringListValue(env.FEISHU_ALLOWED_CHAT_IDS),
          }]
        : undefined,
    },
    providers: {
      openai: {
        apiKey: toStringValue(env.OPENAI_API_KEY),
        baseUrl: toBaseUrlValue(env.OPENAI_BASE_URL),
        orgId: toStringValue(env.OPENAI_ORG_ID),
        model: toStringValue(env.OPENAI_MODEL),
        embeddingModel: toStringValue(env.OPENAI_EMBEDDING_MODEL)
      },
      deepseek: {
        apiKey: toStringValue(env.DEEPSEEK_API_KEY),
        baseUrl: toBaseUrlValue(env.DEEPSEEK_BASE_URL),
        model: toStringValue(env.DEEPSEEK_MODEL),
        embeddingModel: toStringValue(env.DEEPSEEK_EMBEDDING_MODEL)
      },
      volcengine: {
        apiKey: volcengineApiKey,
        baseUrl: volcengineBaseUrl,
        model: toStringValue(env.BYTEDANCE_MODEL ?? env.VOLCENGINE_MODEL),
        embeddingModel: toStringValue(env.BYTEDANCE_EMBEDDING_MODEL ?? env.VOLCENGINE_EMBEDDING_MODEL)
      },
      openrouter: {
        apiKey: toStringValue(env.OPENROUTER_API_KEY),
        baseUrl: toBaseUrlValue(env.OPENROUTER_BASE_URL),
        model: toStringValue(env.OPENROUTER_MODEL),
        embeddingModel: toStringValue(env.OPENROUTER_EMBEDDING_MODEL)
      },
      groq: {
        apiKey: toStringValue(env.GROQ_API_KEY),
        baseUrl: toBaseUrlValue(env.GROQ_BASE_URL),
        model: toStringValue(env.GROQ_MODEL),
        embeddingModel: toStringValue(env.GROQ_EMBEDDING_MODEL)
      },
      moonshot: {
        apiKey: toStringValue(env.MOONSHOT_API_KEY),
        baseUrl: toBaseUrlValue(env.MOONSHOT_BASE_URL),
        model: toStringValue(env.MOONSHOT_MODEL),
        embeddingModel: toStringValue(env.MOONSHOT_EMBEDDING_MODEL)
      },
      qwen: {
        apiKey: toStringValue(env.QWEN_API_KEY),
        baseUrl: toBaseUrlValue(env.QWEN_BASE_URL),
        model: toStringValue(env.QWEN_MODEL),
        embeddingModel: toStringValue(env.QWEN_EMBEDDING_MODEL)
      },
      siliconflow: {
        apiKey: toStringValue(env.SILICONFLOW_API_KEY),
        baseUrl: toBaseUrlValue(env.SILICONFLOW_BASE_URL),
        model: toStringValue(env.SILICONFLOW_MODEL),
        embeddingModel: toStringValue(env.SILICONFLOW_EMBEDDING_MODEL)
      },
      together: {
        apiKey: toStringValue(env.TOGETHER_API_KEY),
        baseUrl: toBaseUrlValue(env.TOGETHER_BASE_URL),
        model: toStringValue(env.TOGETHER_MODEL),
        embeddingModel: toStringValue(env.TOGETHER_EMBEDDING_MODEL)
      }
    }
  };
};
