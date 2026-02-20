import type { ConfigLayer } from "./types";
import {
  toBooleanValue,
  toNetworkMode,
  toNumberValue,
  toStringListValue,
  toStringValue
} from "./value-parsers";

export const envToLayer = (env: NodeJS.ProcessEnv): ConfigLayer => {
  type LlmLayer = NonNullable<ConfigLayer["llm"]>;

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
    providers: {
      openai: {
        apiKey: toStringValue(env.OPENAI_API_KEY),
        baseUrl: toStringValue(env.OPENAI_BASE_URL),
        orgId: toStringValue(env.OPENAI_ORG_ID),
        model: toStringValue(env.OPENAI_MODEL)
      },
      deepseek: {
        apiKey: toStringValue(env.DEEPSEEK_API_KEY),
        baseUrl: toStringValue(env.DEEPSEEK_BASE_URL),
        model: toStringValue(env.DEEPSEEK_MODEL)
      },
      volcengine: {
        apiKey: toStringValue(env.BYTEDANCE_API_KEY ?? env.VOLCENGINE_API_KEY),
        baseUrl: toStringValue(env.BYTEDANCE_BASE_URL ?? env.VOLCENGINE_BASE_URL),
        model: toStringValue(env.BYTEDANCE_MODEL ?? env.VOLCENGINE_MODEL)
      }
    }
  };
};
