import { randomUUID } from "node:crypto";
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import type { AppConfig } from "../../config";
import { writeOpenVikingConfig } from "./config-builder";
import { OpenVikingHttpClient } from "./http-client";
import { resolveOpenVikingCommand } from "./python-resolver";
import type { OpenVikingLaunchResult, OpenVikingRuntime } from "./types";

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

export type CrashEvent = {
  exitCode: number | null;
  signal: string | null;
  willRestart: boolean;
};

export class OpenVikingProcessManager {
  private child?: ChildProcessWithoutNullStreams;
  private runtime?: OpenVikingRuntime;
  private startPromise: Promise<OpenVikingLaunchResult> | null = null;
  private stderrBuffer: string[] = [];
  private restartAttempts = 0;
  private onCrashCallback?: (event: CrashEvent) => void;

  private static readonly MAX_RESTART_ATTEMPTS = 3;
  private static readonly RESTART_DELAY_MS = 2_000;
  private static readonly RESTART_ATTEMPTS_RESET_MS = 120_000;

  constructor(private config: AppConfig) {}

  onCrash(callback: (event: CrashEvent) => void): void {
    this.onCrashCallback = callback;
  }

  getRuntime(): OpenVikingRuntime | undefined {
    return this.runtime;
  }

  createHttpClient(timeoutMs: number = 10_000): OpenVikingHttpClient {
    if (!this.runtime) {
      throw new Error("OpenViking is not running");
    }

    return new OpenVikingHttpClient(this.runtime.url, this.runtime.apiKey, timeoutMs);
  }

  async start(): Promise<OpenVikingLaunchResult> {
    if (this.runtime && this.child && this.child.exitCode === null) {
      return { runtime: this.runtime, child: this.child };
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.doStart().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  async stop(): Promise<void> {
    const child = this.child;
    this.child = undefined;
    this.runtime = undefined;
    this.stderrBuffer = [];

    if (!child || child.exitCode !== null) {
      return;
    }

    child.kill("SIGTERM");
    const exited = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 5_000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve(true);
      });
    });

    if (!exited && child.exitCode === null) {
      child.kill("SIGKILL");
    }
  }

  private findSitePackagesDir(): string | null {
    const searchRoots = [
      path.join(this.config.paths.projectRoot, "python-env", "venv", "lib"),
      path.join(this.config.paths.resourcesDir, "python-env", "venv", "lib")
    ];

    for (const libDir of searchRoots) {
      try {
        const entries = fsSync.readdirSync(libDir);
        const pythonDir = entries.find((e) => e.startsWith("python3"));
        if (!pythonDir) continue;

        const sitePackages = path.join(libDir, pythonDir, "site-packages");
        if (fsSync.existsSync(path.join(sitePackages, "openviking"))) {
          return sitePackages;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  private patchAgfsTimeout(sitePackages: string): void {
    const agfsManagerPath = path.join(sitePackages, "openviking", "agfs_manager.py");
    try {
      let content = fsSync.readFileSync(agfsManagerPath, "utf8");
      const original = "def _wait_for_ready(self, timeout: float = 5.0)";
      const patched  = "def _wait_for_ready(self, timeout: float = 30.0)";

      if (content.includes(patched)) {
        return;
      }

      if (content.includes(original)) {
        content = content.replace(original, patched);
        fsSync.writeFileSync(agfsManagerPath, content, "utf8");
        console.log("[OpenViking] Patched AGFS timeout: 5s -> 30s");
      }
    } catch (error) {
      console.warn("[OpenViking] Could not patch AGFS timeout:", error);
    }
  }

  private warmUpAgfsBinary(sitePackages: string): void {
    const agfsBinary = path.join(sitePackages, "openviking", "bin", "agfs-server");
    try {
      fsSync.accessSync(agfsBinary, fsSync.constants.X_OK);
    } catch {
      return;
    }

    console.log("[OpenViking] Warming up AGFS binary (macOS Gatekeeper may take a moment) ...");
    try {
      execFileSync(agfsBinary, ["--help"], { stdio: "pipe", timeout: 60_000 });
      console.log("[OpenViking] AGFS binary warm-up done");
    } catch {
      console.warn("[OpenViking] AGFS binary warm-up failed (non-fatal)");
    }
  }

  private prepareEnvironment(): void {
    const sitePackages = this.findSitePackagesDir();
    if (!sitePackages) {
      return;
    }

    this.patchAgfsTimeout(sitePackages);
    this.warmUpAgfsBinary(sitePackages);
  }

  /**
   * Remove stale LevelDB LOCK files left behind by a previous OpenViking
   * process that exited without cleanup. Safe to call because we only start
   * one OpenViking child at a time and `this.child` is already confirmed dead
   * or absent before reaching here.
   */
  private removeStaleLockFiles(dataDir: string): void {
    const vectordbDir = path.join(dataDir, "vectordb");
    try {
      if (!fsSync.existsSync(vectordbDir)) return;

      const collections = fsSync.readdirSync(vectordbDir);
      for (const collection of collections) {
        const lockPath = path.join(vectordbDir, collection, "store", "LOCK");
        try {
          if (!fsSync.existsSync(lockPath)) continue;
          fsSync.unlinkSync(lockPath);
          console.log(`[OpenViking] Removed stale lock: ${lockPath}`);
        } catch {
          // Best-effort: if we can't remove it, let OpenViking report the error
        }
      }
    } catch (error) {
      console.warn("[OpenViking] Could not clean stale locks:", error);
    }
  }

  private async doStart(): Promise<OpenVikingLaunchResult> {
    this.prepareEnvironment();

    const host = this.config.openviking.host;
    const port = await this.findAvailablePort(this.config.openviking.port, host);
    const agfsPort = await this.findAvailablePort(Math.max(1_025, port - 100), host);
    const apiKey = this.config.openviking.apiKey.trim() || randomUUID().replace(/-/g, "");

    const runtimeRoot = path.join(this.config.paths.resourcesDir, "openviking");
    const dataDir = path.join(runtimeRoot, "data");
    const configPath = path.join(runtimeRoot, "ov.conf");

    this.removeStaleLockFiles(dataDir);

    await fs.mkdir(dataDir, { recursive: true });
    await writeOpenVikingConfig(configPath, {
      config: this.config,
      host,
      port,
      agfsPort,
      apiKey,
      dataDir
    });

    const resolved = resolveOpenVikingCommand(
      this.config.paths.projectRoot,
      this.config.paths.resourcesDir,
      this.config.openviking.serverCommand,
      this.config.openviking.serverArgs
    );

    const args = [
      ...resolved.args,
      "--config",
      configPath,
      "--host",
      host,
      "--port",
      String(port)
    ];

    const spawnEnv: Record<string, string> = {
      ...this.config.runtime.inheritedEnv,
      OPENVIKING_CONFIG_FILE: configPath,
      NO_PROXY: "localhost,127.0.0.1,::1",
      no_proxy: "localhost,127.0.0.1,::1"
    };
    for (const key of ["http_proxy", "HTTP_PROXY", "https_proxy", "HTTPS_PROXY", "all_proxy", "ALL_PROXY"]) {
      delete spawnEnv[key];
    }

    const child = spawn(resolved.command, args, {
      cwd: runtimeRoot,
      stdio: ["pipe", "pipe", "pipe"],
      env: spawnEnv
    });

    child.stdout.on("data", (chunk: Buffer) => {
      const line = chunk.toString("utf8").trim();
      if (line) {
        console.log(`[OpenViking] ${line}`);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const line = chunk.toString("utf8").trim();
      if (!line) {
        return;
      }

      this.stderrBuffer.push(line);
      if (this.stderrBuffer.length > 60) {
        this.stderrBuffer.shift();
      }
      console.warn(`[OpenViking] ${line}`);
    });

    this.child = child;
    this.runtime = {
      host,
      port,
      agfsPort,
      apiKey,
      configPath,
      dataDir,
      url: `http://${host}:${port}`
    };

    await Promise.race([
      this.waitForHealthy(child, this.runtime.url),
      new Promise<never>((_, reject) => {
        child.once("error", (error) => {
          reject(
            new Error(
              `Failed to start OpenViking process: ${
                error instanceof Error ? error.message : String(error)
              }`
            )
          );
        });
      })
    ]);

    this.restartAttempts = 0;
    this.attachCrashWatcher(child);
    return { runtime: this.runtime, child };
  }

  private attachCrashWatcher(child: ChildProcessWithoutNullStreams): void {
    const startedAt = Date.now();

    child.once("exit", (code, signal) => {
      if (this.child !== child) return;

      this.child = undefined;
      this.runtime = undefined;

      if (Date.now() - startedAt > OpenVikingProcessManager.RESTART_ATTEMPTS_RESET_MS) {
        this.restartAttempts = 0;
      }

      const canRestart = this.restartAttempts < OpenVikingProcessManager.MAX_RESTART_ATTEMPTS;
      this.restartAttempts += 1;

      console.warn(
        `[OpenViking] Process exited unexpectedly (code=${code}, signal=${signal}). ` +
        `Restart attempt ${this.restartAttempts}/${OpenVikingProcessManager.MAX_RESTART_ATTEMPTS}.`
      );

      if (!canRestart) {
        console.error("[OpenViking] Max restart attempts exhausted, giving up.");
        this.onCrashCallback?.({ exitCode: code, signal: signal?.toString() ?? null, willRestart: false });
        return;
      }

      const delay = OpenVikingProcessManager.RESTART_DELAY_MS * this.restartAttempts;
      console.log(`[OpenViking] Scheduling restart in ${delay}ms...`);

      setTimeout(() => {
        void this.start()
          .then(() => {
            console.log("[OpenViking] Auto-restart succeeded");
            this.onCrashCallback?.({ exitCode: code, signal: signal?.toString() ?? null, willRestart: true });
          })
          .catch((err) => {
            console.error("[OpenViking] Auto-restart failed:", err);
            this.onCrashCallback?.({ exitCode: code, signal: signal?.toString() ?? null, willRestart: false });
          });
      }, delay);
    });
  }

  private async waitForHealthy(child: ChildProcessWithoutNullStreams, baseUrl: string): Promise<void> {
    const timeoutMs = this.config.openviking.startTimeoutMs;
    const intervalMs = this.config.openviking.healthcheckIntervalMs;
    const startAt = Date.now();
    const client = new OpenVikingHttpClient(baseUrl, "", Math.min(2_000, timeoutMs));

    while (Date.now() - startAt < timeoutMs) {
      if (child.exitCode !== null) {
        throw new Error(
          `OpenViking exited before healthy (exitCode=${child.exitCode}). ${this.getRecentStderr()}`
        );
      }

      if (await client.health()) {
        return;
      }

      await sleep(intervalMs);
    }

    await this.stop();
    throw new Error(`OpenViking health check timeout after ${timeoutMs}ms. ${this.getRecentStderr()}`);
  }

  private getRecentStderr(): string {
    if (this.stderrBuffer.length === 0) {
      return "No stderr output captured.";
    }
    return `Recent stderr:\n${this.stderrBuffer.slice(-8).join("\n")}`;
  }

  private async findAvailablePort(startPort: number, host: string): Promise<number> {
    let port = Math.max(1, Math.floor(startPort));

    for (let i = 0; i < 120; i += 1) {
      if (await this.isPortAvailable(port, host)) {
        return port;
      }
      port += 1;
    }

    throw new Error(`Could not find available port from ${startPort}`);
  }

  private async isPortAvailable(port: number, host: string): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      const server = net.createServer();

      server.once("error", () => {
        resolve(false);
      });

      server.once("listening", () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.listen(port, host);
    });
  }
}
