import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "./default-config";
import { resolveModelTarget } from "./model-routing";

const createConfig = () => {
  const workspaceDir = path.resolve("/tmp/bandry-model-routing");
  const config = createDefaultConfig({
    paths: {
      projectRoot: workspaceDir,
      bandryHome: workspaceDir,
      configDir: path.join(workspaceDir, "config"),
      logsDir: path.join(workspaceDir, "logs"),
      workspaceDir,
      workspacesDir: workspaceDir,
      resourcesDir: path.join(workspaceDir, "resources"),
      pluginsDir: path.join(workspaceDir, "plugins"),
      traceDir: path.join(workspaceDir, "traces"),
      projectConfigPath: path.join(workspaceDir, "config.json"),
      userConfigPath: path.join(workspaceDir, "user-config.json"),
      auditLogPath: path.join(workspaceDir, "model-audit.log"),
      sandboxAuditLogPath: path.join(workspaceDir, "sandbox-audit.log"),
      databasePath: path.join(workspaceDir, "bandry.db"),
      dotenvPath: path.join(workspaceDir, ".env")
    },
    runtime: {
      inheritedEnv: {}
    }
  });

  config.providers.openai.apiKey = "openai-key";
  config.providers.deepseek.apiKey = "deepseek-key";
  config.providers.volcengine.apiKey = "volc-key";
  return config;
};

describe("resolveModelTarget", () => {
  it("uses role assignment when assignment is usable", () => {
    const config = createConfig();
    config.routing.assignments["sub.writer"] = "profile_deepseek_default";

    const target = resolveModelTarget(config, "sub.writer");

    expect(target.profileId).toBe("profile_deepseek_default");
    expect(target.provider).toBe("deepseek");
    expect(target.model).toBe("deepseek-chat");
  });

  it("uses override profile when override is usable", () => {
    const config = createConfig();

    const target = resolveModelTarget(config, "chat.default", "profile_volcengine_default");

    expect(target.profileId).toBe("profile_volcengine_default");
    expect(target.provider).toBe("volcengine");
  });

  it("falls back to first usable profile when assigned profile provider is not configured", () => {
    const config = createConfig();
    config.providers.openai.apiKey = "";
    config.routing.assignments["chat.default"] = "profile_openai_default";

    const target = resolveModelTarget(config, "chat.default");

    expect(target.profileId).toBe("profile_deepseek_default");
    expect(target.provider).toBe("deepseek");
  });

  it("falls back to first enabled profile when no provider has api key", () => {
    const config = createConfig();
    config.providers.openai.apiKey = "";
    config.providers.deepseek.apiKey = "";
    config.providers.volcengine.apiKey = "";
    config.routing.assignments["lead.planner"] = "profile_volcengine_default";

    const target = resolveModelTarget(config, "lead.planner");

    expect(target.profileId).toBe("profile_openai_default");
    expect(target.provider).toBe("openai");
  });
});
