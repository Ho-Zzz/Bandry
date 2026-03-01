import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ModelsCatalogService } from "../../llm";
import { loadAppConfig } from "../../config";
import { ModelOnboardingService } from "../model-onboarding-service";
import { SettingsService } from "../settings-service";

const createServices = async (seed: string) => {
  const bandryHome = path.join(os.tmpdir(), `bandry-onboarding-${seed}-${Date.now()}`);
  const catalogFile = path.join(bandryHome, "catalog.json");
  await fs.mkdir(path.dirname(catalogFile), { recursive: true });
  await fs.writeFile(
    catalogFile,
    JSON.stringify({
      providers: [
        {
          id: "openai",
          name: "OpenAI",
          models: [
            { id: "gpt-4.1-mini", name: "GPT 4.1 Mini", tool_call: true },
            { id: "gpt-4o-mini", name: "GPT 4o Mini" }
          ]
        },
        {
          id: "deepseek",
          name: "DeepSeek",
          models: [{ id: "deepseek-chat", name: "DeepSeek Chat" }]
        }
      ]
    }),
    "utf8"
  );

  const config = loadAppConfig({
    cwd: "/Users/bytedance/Workspace/hozzz/Bandry",
    userHome: bandryHome,
    env: {
      ...process.env,
      BANDRY_HOME: bandryHome
    },
    skipDotenv: true
  });
  config.catalog.source = {
    type: "file",
    location: catalogFile,
    schema: "models.dev",
    timeoutMs: 5000
  };

  const settingsService = new SettingsService({ config });
  const catalogService = new ModelsCatalogService(config);
  const onboardingService = new ModelOnboardingService(settingsService, catalogService);
  return {
    onboardingService
  };
};

describe("ModelOnboardingService", () => {
  it("patches Volcengine provider and embedding model when catalog source misses it", async () => {
    const { onboardingService } = await createServices("patch-volcengine");

    const catalog = await onboardingService.listCatalog();
    const volcengine = catalog.providers.find((provider) => provider.id === "volcengine");
    expect(volcengine).toBeDefined();

    const embedding = volcengine?.models.find((model) => model.id === "doubao-embedding-vision-250615");
    expect(embedding).toBeDefined();
    expect(embedding?.capabilities.isEmbeddingModel).toBe(true);
    expect(embedding?.capabilities.inputModalities).toContain("image");
    expect(volcengine?.models.some((model) => model.id === "doubao-seed-2-0-lite-260215")).toBe(true);
    expect(volcengine?.models.some((model) => model.id === "doubao-seed-2-0-mini-260215")).toBe(true);
    expect(volcengine?.models.some((model) => model.id === "doubao-seed-2-0-pro-260215")).toBe(true);

    const proResult = await onboardingService.connect({
      provider: "volcengine",
      modelId: "doubao-seed-2-0-pro-260215",
      apiKey: "ark-test-key"
    });
    expect(proResult.ok).toBe(true);
    expect(proResult.profile.model).toBe("doubao-seed-2-0-pro-260215");

    const result = await onboardingService.connect({
      provider: "volcengine",
      modelId: "doubao-embedding-vision-250615",
      apiKey: "ark-test-key"
    });
    expect(result.ok).toBe(true);
    expect(result.profile.provider).toBe("volcengine");
    expect(result.profile.model).toBe("doubao-embedding-vision-250615");
  });

  it("connects a new model profile and can set it as chat default", async () => {
    const { onboardingService } = await createServices("connect");

    const result = await onboardingService.connect({
      provider: "openai",
      modelId: "gpt-4o-mini",
      apiKey: "sk-test-openai"
    });

    expect(result.ok).toBe(true);
    expect(result.profile.provider).toBe("openai");
    expect(result.profile.model).toBe("gpt-4o-mini");
    expect(result.profile.providerName).toBe("OpenAI");
    expect(result.profile.isChatDefault).toBe(false);

    const setDefault = await onboardingService.setChatDefault({
      profileId: result.profile.profileId
    });
    expect(setDefault.ok).toBe(true);

    const connected = onboardingService.listConnected();
    expect(connected.chatDefaultProfileId).toBe(result.profile.profileId);
    expect(connected.models.some((item) => item.profileId === result.profile.profileId)).toBe(true);
  });

  it("blocks removing a profile that is still bound to runtime roles", async () => {
    const { onboardingService } = await createServices("remove");

    const connected = await onboardingService.connect({
      provider: "openai",
      modelId: "gpt-4o-mini",
      apiKey: "sk-test-openai"
    });
    const setDefault = await onboardingService.setChatDefault({
      profileId: connected.profile.profileId
    });
    expect(setDefault.ok).toBe(true);

    await expect(
      onboardingService.remove({
        profileId: connected.profile.profileId
      })
    ).rejects.toThrow(
      `Model profile ${connected.profile.profileId} is still bound to roles: chat.default. Rebind these roles first.`
    );

    const revertDefault = await onboardingService.setChatDefault({
      profileId: "profile_openai_default"
    });
    expect(revertDefault.ok).toBe(true);

    const removeResult = await onboardingService.remove({
      profileId: connected.profile.profileId
    });
    expect(removeResult.ok).toBe(true);
  });
});
