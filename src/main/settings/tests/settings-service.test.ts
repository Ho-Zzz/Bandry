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
});
