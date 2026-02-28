import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAppConfig } from "../../../config";
import { buildOpenVikingConfig } from "../config-builder";

const createConfig = async (seed: string) => {
  const bandryHome = path.join(os.tmpdir(), `bandry-openviking-${seed}-${Date.now()}`);
  await fs.mkdir(bandryHome, { recursive: true });
  return loadAppConfig({
    cwd: "/Users/bytedance/Workspace/hozzz/Bandry",
    userHome: bandryHome,
    env: {
      ...process.env,
      BANDRY_HOME: bandryHome
    },
    skipDotenv: true
  });
};

describe("buildOpenVikingConfig", () => {
  it("fails when required profile bindings are missing", async () => {
    const config = await createConfig("missing");
    config.openviking.vlmProfileId = "";
    config.openviking.embeddingProfileId = "";

    expect(() =>
      buildOpenVikingConfig({
        config,
        host: "127.0.0.1",
        port: 1933,
        agfsPort: 1833,
        apiKey: "test",
        dataDir: "/tmp"
      })
    ).toThrow("openviking.vlmProfileId is required");
  });

  it("fails when profile provider is not openai/volcengine", async () => {
    const config = await createConfig("provider");
    config.providers.deepseek.apiKey = "sk-deepseek-valid-key-1234567890";
    config.openviking.vlmProfileId = "profile_deepseek_default";
    config.openviking.embeddingProfileId = "profile_openai_default";
    config.providers.openai.apiKey = "sk-openai-valid-key-1234567890";

    expect(() =>
      buildOpenVikingConfig({
        config,
        host: "127.0.0.1",
        port: 1933,
        agfsPort: 1833,
        apiKey: "test",
        dataDir: "/tmp"
      })
    ).toThrow("only supports openai/volcengine");
  });

  it("builds config from bound profiles and sets embedding dimension by provider/model", async () => {
    const config = await createConfig("ok");
    config.providers.openai.apiKey = "sk-openai-valid-key-1234567890";
    config.providers.volcengine.apiKey = "ark-valid-key";
    config.openviking.vlmProfileId = "profile_openai_default";
    config.openviking.embeddingProfileId = "profile_volcengine_default";

    const result = buildOpenVikingConfig({
      config,
      host: "127.0.0.1",
      port: 1933,
      agfsPort: 1833,
      apiKey: "test",
      dataDir: "/tmp"
    }) as {
      vlm: { provider: string; model: string };
      embedding: { dense: { provider: string; model: string; dimension: number } };
    };

    expect(result.vlm.provider).toBe("openai");
    expect(result.vlm.model).toBe("gpt-4.1-mini");
    expect(result.embedding.dense.provider).toBe("volcengine");
    expect(result.embedding.dense.model).toBe("doubao-seed-1-6-250615");
    expect(result.embedding.dense.dimension).toBe(1024);
  });
});
