import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "./default-config";
import { ModelRoutingError, resolveModelTarget } from "./model-routing";

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

  config.providers.openai.apiKey = "sk-openai-valid-key-1234567890";
  config.providers.deepseek.apiKey = "sk-deepseek-valid-key-1234567890";
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

  it("throws when assigned profile provider is not configured", () => {
    const config = createConfig();
    config.providers.openai.apiKey = "";
    config.routing.assignments["chat.default"] = "profile_openai_default";

    expect(() => resolveModelTarget(config, "chat.default")).toThrowError(ModelRoutingError);
    expect(() => resolveModelTarget(config, "chat.default")).toThrowError(
      '[chat.default] provider "openai" for profile "profile_openai_default" has missing or invalid API key.'
    );
  });

  it("throws when assigned profile provider is disabled", () => {
    const config = createConfig();
    config.providers.volcengine.enabled = false;
    config.routing.assignments["lead.planner"] = "profile_volcengine_default";

    expect(() => resolveModelTarget(config, "lead.planner")).toThrowError(ModelRoutingError);
    expect(() => resolveModelTarget(config, "lead.planner")).toThrowError(
      '[lead.planner] provider "volcengine" for profile "profile_volcengine_default" is disabled.'
    );
  });

  it("throws when assigned profile api key is invalid", () => {
    const config = createConfig();
    config.providers.openai.apiKey = "123123123";
    config.routing.assignments["lead.planner"] = "profile_openai_default";

    expect(() => resolveModelTarget(config, "lead.planner")).toThrowError(ModelRoutingError);
    expect(() => resolveModelTarget(config, "lead.planner")).toThrowError(
      '[lead.planner] provider "openai" for profile "profile_openai_default" has missing or invalid API key.'
    );
  });

  it("throws when role assignment is missing", () => {
    const config = createConfig();
    config.routing.assignments["sub.writer"] = "";

    expect(() => resolveModelTarget(config, "sub.writer")).toThrowError(ModelRoutingError);
    expect(() => resolveModelTarget(config, "sub.writer")).toThrowError(
      "[sub.writer] has no assigned profile. Please bind a model profile in People / Model Studio."
    );
  });

  it("throws when override profile does not exist", () => {
    const config = createConfig();

    expect(() => resolveModelTarget(config, "chat.default", "profile_not_found")).toThrowError(
      '[chat.default] override profile "profile_not_found" was not found.'
    );
  });
});
