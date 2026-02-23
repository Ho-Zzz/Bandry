import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import type { AppConfig } from "../../config";
import { writeOpenVikingConfig } from "./config-builder";
import { OpenVikingHttpClient } from "./http-client";
import type { OpenVikingLaunchResult, OpenVikingRuntime } from "./types";

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

export class OpenVikingProcessManager {
  private child?: ChildProcessWithoutNullStreams;
  private runtime?: OpenVikingRuntime;
  private startPromise: Promise<OpenVikingLaunchResult> | null = null;
  private stderrBuffer: string[] = [];

  constructor(private config: AppConfig) {}

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

  private async doStart(): Promise<OpenVikingLaunchResult> {
    const host = this.config.openviking.host;
    const port = await this.findAvailablePort(this.config.openviking.port, host);
    const agfsPort = await this.findAvailablePort(Math.max(1_025, port - 100), host);
    const apiKey = this.config.openviking.apiKey.trim() || randomUUID().replace(/-/g, "");

    const runtimeRoot = path.join(this.config.paths.resourcesDir, "openviking");
    const dataDir = path.join(runtimeRoot, "data");
    const configPath = path.join(runtimeRoot, "ov.conf");

    await fs.mkdir(dataDir, { recursive: true });
    await writeOpenVikingConfig(configPath, {
      config: this.config,
      host,
      port,
      agfsPort,
      apiKey,
      dataDir
    });

    const args = [
      ...this.config.openviking.serverArgs,
      "--config",
      configPath,
      "--host",
      host,
      "--port",
      String(port)
    ];

    const child = spawn(this.config.openviking.serverCommand, args, {
      cwd: runtimeRoot,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...this.config.runtime.inheritedEnv,
        OPENVIKING_CONFIG_FILE: configPath
      }
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
    return { runtime: this.runtime, child };
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
