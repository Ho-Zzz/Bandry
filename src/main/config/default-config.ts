import type { AppConfig } from "./types";

type CreateDefaultConfigInput = {
  workspaceDir: string;
  projectConfigPath: string;
  userConfigPath: string;
  auditLogPath: string;
  sandboxAuditLogPath: string;
  databasePath: string;
  traceDir: string;
  resourcesDir: string;
};

export const createDefaultConfig = (input: CreateDefaultConfigInput): AppConfig => {
  return {
    llm: {
      defaultProvider: "openai",
      defaultModel: "gpt-4.1-mini",
      timeoutMs: 60_000,
      maxRetries: 3,
      retryBaseMs: 500,
      rateLimitRps: 2,
      networkMode: "auto",
      offlineNonModelOnly: true,
      auditLogEnabled: true,
      piiRedactionEnabled: true
    },
    sandbox: {
      virtualRoot: "/mnt/workspace",
      allowedWorkspaces: [input.workspaceDir],
      allowedCommands: ["ls", "cat", "mkdir", "echo"],
      execTimeoutMs: 30_000,
      maxOutputBytes: 64 * 1024,
      auditLogEnabled: true
    },
    providers: {
      openai: {
        enabled: true,
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4.1-mini",
        orgId: ""
      },
      deepseek: {
        enabled: true,
        apiKey: "",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-chat"
      },
      volcengine: {
        enabled: true,
        apiKey: "",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
        model: "doubao-seed-1-6-250615"
      }
    },
    features: {
      enableMiddleware: false,
      enableMultiAgent: false,
      enableMemory: false,
      enableMCP: false
    },
    paths: {
      workspaceDir: input.workspaceDir,
      projectConfigPath: input.projectConfigPath,
      userConfigPath: input.userConfigPath,
      auditLogPath: input.auditLogPath,
      sandboxAuditLogPath: input.sandboxAuditLogPath,
      databasePath: input.databasePath,
      traceDir: input.traceDir,
      resourcesDir: input.resourcesDir
    }
  };
};
