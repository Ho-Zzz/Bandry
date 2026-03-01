import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAppConfig } from "../../config";
import { SettingsService } from "../settings-service";

const createService = async (seed: string): Promise<SettingsService> => {
  const bandryHome = path.join(os.tmpdir(), `bandry-settings-${seed}-${Date.now()}`);
  await fs.mkdir(bandryHome, { recursive: true });
  const config = loadAppConfig({
    cwd: "/Users/bytedance/Workspace/hozzz/Bandry",
    userHome: bandryHome,
    env: {
      ...process.env,
      BANDRY_HOME: bandryHome
    },
    skipDotenv: true
  });
  return new SettingsService({ config });
};

describe("SettingsService memory validation", () => {
  it("rejects enabling memory without openviking profile bindings", async () => {
    const service = await createService("missing-bindings");
    const state = service.getState();
    state.memory.enableMemory = true;
    state.memory.openviking.enabled = true;
    state.memory.openviking.vlmProfileId = "";
    state.memory.openviking.embeddingProfileId = "";

    const result = await service.saveState({ state });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("OpenViking vlmProfileId 未配置");
  });

  it("rejects non-openai/volcengine profile bindings", async () => {
    const service = await createService("provider-blocked");
    const state = service.getState();
    state.memory.enableMemory = true;
    state.memory.openviking.enabled = true;
    state.providers.deepseek.apiKey = "sk-deepseek-valid-key-1234567890";
    state.memory.openviking.vlmProfileId = "profile_deepseek_default";
    state.memory.openviking.embeddingProfileId = "profile_deepseek_default";

    const result = await service.saveState({ state });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("仅支持 OpenAI/Volcengine");
  });

  it("accepts valid openai/volcengine bindings with usable credentials", async () => {
    const service = await createService("valid");
    const state = service.getState();
    state.memory.enableMemory = true;
    state.memory.openviking.enabled = true;
    state.providers.openai.apiKey = "sk-openai-valid-key-1234567890";
    state.providers.volcengine.apiKey = "ark-valid-key";
    state.memory.openviking.vlmProfileId = "profile_openai_default";
    state.memory.openviking.embeddingProfileId = "profile_volcengine_default";

    const result = await service.saveState({ state });
    expect(result.ok).toBe(true);
  });

  it("rejects enabling channels without enabled channel entries", async () => {
    const service = await createService("channels-empty");
    const state = service.getState();
    state.channels.enabled = true;
    state.channels.channels = [];

    const result = await service.saveState({ state });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("至少需要一个启用中的 Channel");
  });

  it("rejects enabled feishu channel with missing app credentials", async () => {
    const service = await createService("channels-invalid");
    const state = service.getState();
    state.channels.enabled = true;
    state.channels.channels = [
      {
        id: "ops",
        type: "feishu",
        appId: "",
        appSecret: "",
        allowedChatIds: [],
        enabled: true
      }
    ];

    const result = await service.saveState({ state });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("appId");
    expect(result.message).toContain("appSecret");
  });

  it("accepts valid feishu channels config and persists to runtime state", async () => {
    const service = await createService("channels-valid");
    const state = service.getState();
    state.channels.enabled = true;
    state.channels.channels = [
      {
        id: "ops_feishu",
        name: "Ops",
        type: "feishu",
        appId: "app_123",
        appSecret: "secret_123",
        allowedChatIds: ["chat_1", "chat_2"],
        enabled: true
      }
    ];

    const result = await service.saveState({ state });
    expect(result.ok).toBe(true);

    const latest = service.getState();
    expect(latest.channels.enabled).toBe(true);
    expect(latest.channels.channels).toHaveLength(1);
    expect(latest.channels.channels[0].id).toBe("ops_feishu");
    expect(latest.channels.channels[0].appId).toBe("app_123");
  });
});
