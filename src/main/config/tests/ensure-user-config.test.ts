import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadAppConfig } from "../load-config";
import { ensureUserConfigFile } from "../ensure-user-config";

const tempRoots: string[] = [];

const createFixture = async (): Promise<{ workspaceDir: string; userHome: string; rootDir: string }> => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "bandry-config-init-"));
  tempRoots.push(rootDir);
  const workspaceDir = path.join(rootDir, "workspace");
  const userHome = path.join(rootDir, "home");
  await fs.mkdir(path.join(workspaceDir, ".bandry"), { recursive: true });
  return { workspaceDir, userHome, rootDir };
};

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0, tempRoots.length).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    })
  );
});

describe("ensureUserConfigFile", () => {
  it("creates initial config with empty secrets when user config does not exist", async () => {
    const fixture = await createFixture();
    const config = loadAppConfig({
      cwd: fixture.workspaceDir,
      userHome: fixture.userHome,
      env: {}
    });

    ensureUserConfigFile(config);
    const raw = await fs.readFile(config.paths.userConfigPath, "utf8");
    const parsed = JSON.parse(raw) as {
      providers: Record<string, { apiKey: string }>;
      tools: {
        webSearch: { apiKey: string };
        webFetch: { apiKey: string };
        githubSearch: { apiKey: string };
      };
      openviking: { apiKey: string };
    };

    for (const provider of Object.values(parsed.providers)) {
      expect(provider.apiKey).toBe("");
    }
    expect(parsed.tools.webSearch.apiKey).toBe("");
    expect(parsed.tools.webFetch.apiKey).toBe("");
    expect(parsed.tools.githubSearch.apiKey).toBe("");
    expect(parsed.openviking.apiKey).toBe("");
  });
});

