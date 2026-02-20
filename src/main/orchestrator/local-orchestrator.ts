import path from "node:path";
import type { AppConfig } from "../config";
import type { ModelsFactory } from "../models";
import type { SandboxService } from "../sandbox";
import type {
  OrchestratorResult,
  OrchestratorTaskInput,
  PlannedToolCall,
  TaskProgressCallback,
  ToolObservation
} from "./types";

const MAX_OBSERVATION_TEXT = 1200;

const asVirtualPath = (inputPath: string, virtualRoot: string): string => {
  const normalized = inputPath.replaceAll("\\", "/").trim();
  if (!normalized) {
    return virtualRoot;
  }
  if (normalized.startsWith("/")) {
    return normalized;
  }
  return path.posix.join(virtualRoot, normalized);
};

const normalizeSpaces = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

const truncate = (value: string, max: number): string => {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}...`;
};

const extractVirtualPaths = (prompt: string, virtualRoot: string): string[] => {
  const escapedRoot = virtualRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const directPattern = new RegExp(`${escapedRoot}(?:\\/[^\\s"';,，。！？]*)?`, "g");
  const matches = prompt.match(directPattern) ?? [];
  return Array.from(new Set(matches.map((item) => item.replace(/[.,;:!?，。；：！？]+$/g, ""))));
};

const looksLikeReadIntent = (prompt: string): boolean => {
  const lower = prompt.toLowerCase();
  return (
    lower.includes("read ") ||
    lower.includes("读取") ||
    lower.includes("查看文件") ||
    lower.includes("open file") ||
    lower.includes("内容")
  );
};

const looksLikeListIntent = (prompt: string): boolean => {
  const lower = prompt.toLowerCase();
  return (
    lower.includes("list ") ||
    lower.includes("列出") ||
    lower.includes("目录") ||
    lower.includes("files") ||
    lower.includes("folder")
  );
};

const looksLikeExecIntent = (prompt: string): boolean => {
  const lower = prompt.toLowerCase();
  return lower.includes("run ls") || lower.includes("执行 ls") || /\bls\s/.test(lower);
};

const mapObservation = (observation: ToolObservation): string => {
  if (observation.kind === "list_dir") {
    const names = observation.output.entries.map((entry) => `${entry.type}:${entry.name}`).join(", ");
    return `list_dir ${observation.input.path} -> ${truncate(names, MAX_OBSERVATION_TEXT)}`;
  }

  if (observation.kind === "read_file") {
    return `read_file ${observation.input.path} -> ${truncate(observation.output.content, MAX_OBSERVATION_TEXT)}`;
  }

  if (observation.kind === "exec") {
    const command = [observation.input.command, ...(observation.input.args ?? [])].join(" ");
    const output = [observation.output.stdout, observation.output.stderr].filter(Boolean).join("\n");
    return `exec ${command} -> ${truncate(output, MAX_OBSERVATION_TEXT)}`;
  }

  return `tool_error ${JSON.stringify(observation.input)} -> ${observation.message}`;
};

export class LocalOrchestrator {
  constructor(
    private readonly config: AppConfig,
    private readonly sandboxService: SandboxService,
    private readonly modelsFactory: ModelsFactory
  ) {}

  async runTask(input: OrchestratorTaskInput, onProgress: TaskProgressCallback): Promise<OrchestratorResult> {
    const plan = this.planTools(input);
    const observations: ToolObservation[] = [];

    onProgress("running", 0.08, `Planner generated ${plan.length} tool step(s)`);

    for (let index = 0; index < plan.length; index += 1) {
      const call = plan[index];
      const baseProgress = 0.1 + ((index + 1) / Math.max(plan.length, 1)) * 0.55;

      if (call.kind === "list_dir") {
        onProgress("running", baseProgress, `Tool ${index + 1}/${plan.length}: list_dir ${call.path}`);
        try {
          const output = await this.sandboxService.listDir({ path: call.path });
          observations.push({
            kind: "list_dir",
            input: { path: call.path },
            output
          });
        } catch (error) {
          observations.push({
            kind: "error",
            input: { kind: "list_dir", path: call.path },
            message: error instanceof Error ? error.message : "list_dir failed"
          });
        }
        continue;
      }

      if (call.kind === "read_file") {
        onProgress("running", baseProgress, `Tool ${index + 1}/${plan.length}: read_file ${call.path}`);
        try {
          const output = await this.sandboxService.readFile({ path: call.path });
          observations.push({
            kind: "read_file",
            input: { path: call.path },
            output
          });
        } catch (error) {
          observations.push({
            kind: "error",
            input: { kind: "read_file", path: call.path },
            message: error instanceof Error ? error.message : "read_file failed"
          });
        }
        continue;
      }

      onProgress("running", baseProgress, `Tool ${index + 1}/${plan.length}: exec ${call.command}`);
      try {
        const output = await this.sandboxService.exec({
          command: call.command,
          args: call.args,
          cwd: call.cwd
        });
        observations.push({
          kind: "exec",
          input: {
            command: call.command,
            args: call.args,
            cwd: call.cwd
          },
          output
        });
      } catch (error) {
        observations.push({
          kind: "error",
          input: { kind: "exec", command: call.command, args: call.args, cwd: call.cwd },
          message: error instanceof Error ? error.message : "exec failed"
        });
      }
    }

    const localSummary = this.buildLocalSummary(input.prompt, observations);
    const shouldUseModel = input.useModel !== false && this.modelsFactory.isProviderConfigured(this.config.llm.defaultProvider);
    if (!shouldUseModel) {
      onProgress("running", 0.9, "Model step skipped, returning local summary");
      return {
        usedModel: false,
        observations,
        outputText: localSummary
      };
    }

    onProgress("running", 0.82, `Model synthesis with ${this.config.llm.defaultProvider}`);

    try {
      const modelResult = await this.modelsFactory.generateText({
        prompt: [
          "You are Bandry orchestrator. Summarize tool observations and provide direct next actions.",
          `User request: ${input.prompt}`,
          "Tool observations:",
          ...observations.map((item, index) => `${index + 1}. ${mapObservation(item)}`)
        ].join("\n"),
        provider: this.config.llm.defaultProvider,
        model: this.config.llm.defaultModel,
        taskId: input.taskId
      });

      return {
        usedModel: true,
        provider: modelResult.provider,
        model: modelResult.model,
        modelResult,
        observations,
        outputText: modelResult.text
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Model synthesis failed";
      return {
        usedModel: false,
        observations: [
          ...observations,
          {
            kind: "error",
            input: { kind: "model" },
            message
          }
        ],
        outputText: `${localSummary}\n\nModel synthesis failed: ${message}`
      };
    }
  }

  private planTools(input: OrchestratorTaskInput): PlannedToolCall[] {
    const prompt = input.prompt;
    const virtualRoot = this.config.sandbox.virtualRoot;
    const planned: PlannedToolCall[] = [];
    const seen = new Set<string>();

    const add = (call: PlannedToolCall): void => {
      const key = JSON.stringify(call);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      planned.push(call);
    };

    if (looksLikeListIntent(prompt) || prompt.length > 0) {
      add({ kind: "list_dir", path: virtualRoot });
    }

    const explicitVirtualPaths = extractVirtualPaths(prompt, virtualRoot);
    for (const file of input.files) {
      explicitVirtualPaths.push(asVirtualPath(file, virtualRoot));
    }

    for (const filePath of explicitVirtualPaths) {
      if (looksLikeReadIntent(prompt) || filePath.includes(".")) {
        add({ kind: "read_file", path: filePath });
      }
    }

    if (looksLikeExecIntent(prompt)) {
      add({
        kind: "exec",
        command: "ls",
        args: ["-la", virtualRoot],
        cwd: virtualRoot
      });
    }

    return planned;
  }

  private buildLocalSummary(prompt: string, observations: ToolObservation[]): string {
    const observationLines = observations.map((item, index) => `${index + 1}. ${mapObservation(item)}`);
    const header = `Task processed locally for prompt: ${normalizeSpaces(prompt)}`;
    if (observationLines.length === 0) {
      return `${header}\nNo tool observations were produced.`;
    }
    return `${header}\n${observationLines.join("\n")}`;
  }
}
