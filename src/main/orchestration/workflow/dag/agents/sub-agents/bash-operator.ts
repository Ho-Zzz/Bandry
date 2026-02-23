import type { SandboxService } from "../../../../../sandbox";
import { BaseAgent } from "../base-agent";
import { resolveRuntimeTarget } from "../../../../../llm/runtime/runtime-target";
import type { AgentRole, AgentResult, AgentExecutionInput } from "../types";
import { buildBashOperatorAgentPrompt } from "./prompts";
import { normalizeSpaces } from "../../../../chat/text-utils";

type ParsedCommand = {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
};

const tokenizeCommand = (line: string): string[] => {
  const tokens = line.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return tokens.map((token) => token.replace(/^['"]|['"]$/g, ""));
};

const extractJsonCommand = (prompt: string): ParsedCommand | null => {
  const fenced = prompt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], prompt];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    try {
      const parsed = JSON.parse(candidate.trim()) as Record<string, unknown>;
      if (typeof parsed.command !== "string" || parsed.command.trim().length === 0) {
        continue;
      }
      return {
        command: parsed.command.trim(),
        args: Array.isArray(parsed.args)
          ? parsed.args.filter((item): item is string => typeof item === "string")
          : undefined,
        cwd: typeof parsed.cwd === "string" ? parsed.cwd : undefined,
        timeoutMs: typeof parsed.timeoutMs === "number" && Number.isFinite(parsed.timeoutMs) ? parsed.timeoutMs : undefined
      };
    } catch {
      // ignore parse errors and continue
    }
  }
  return null;
};

const extractFencedBashCommand = (prompt: string): ParsedCommand | null => {
  const fenced = prompt.match(/```(?:bash|sh)\s*([\s\S]*?)```/i);
  if (!fenced?.[1]) {
    return null;
  }

  const firstLine = fenced[1]
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#"));
  if (!firstLine) {
    return null;
  }

  const [command, ...args] = tokenizeCommand(firstLine);
  if (!command) {
    return null;
  }

  return {
    command,
    args
  };
};

/**
 * Bash Operator Agent
 * Executes shell commands with strict sandboxing
 * Limited to workspace directory and allowed commands
 */
export class BashOperatorAgent extends BaseAgent {
  constructor(
    appConfig: ConstructorParameters<typeof BaseAgent>[0],
    modelsFactory: ConstructorParameters<typeof BaseAgent>[1],
    config: ConstructorParameters<typeof BaseAgent>[2],
    private readonly sandboxService?: SandboxService
  ) {
    super(appConfig, modelsFactory, config);
  }

  protected getRole(): AgentRole {
    return "bash_operator";
  }

  protected getDefaultTools(): string[] {
    return ["execute_bash", "read_local_file", "list_dir", "write_to_file"];
  }

  protected getDefaultSystemPrompt(): string {
    return buildBashOperatorAgentPrompt(this.appConfig.sandbox.allowedCommands);
  }

  async execute(input: AgentExecutionInput): Promise<AgentResult> {
    let binding = "[sub.bash_operator]";
    try {
      const parsedCommand =
        extractJsonCommand(input.prompt) ??
        extractFencedBashCommand(input.prompt);

      if (parsedCommand && this.sandboxService) {
        const execResult = await this.sandboxService.exec({
          command: parsedCommand.command,
          args: parsedCommand.args,
          cwd: parsedCommand.cwd ?? this.appConfig.sandbox.virtualRoot,
          timeoutMs: parsedCommand.timeoutMs
        });

        const output = normalizeSpaces(
          [
            `$ ${[parsedCommand.command, ...(parsedCommand.args ?? [])].join(" ")}`,
            execResult.stdout.trim(),
            execResult.stderr.trim()
          ]
            .filter((item) => item.length > 0)
            .join("\n")
        );

        if (execResult.exitCode !== 0) {
          return this.errorResult(
            `${binding} command failed with exit code ${execResult.exitCode}: ${output}`
          );
        }

        return this.successResult(output || "Command executed successfully");
      }

      const messages = input.messages || [
        { role: "system" as const, content: this.config.systemPrompt! },
        {
          role: "user" as const,
          content: `${input.prompt}\n\nWorkspace: ${input.workspacePath}`
        }
      ];
      const target = resolveRuntimeTarget(this.appConfig, "sub.bash_operator");
      binding = `[sub.bash_operator profile=${target.profileId} model=${target.provider}/${target.model}]`;

      const result = await this.modelsFactory.generateText({
        runtimeConfig: target.runtimeConfig,
        model: target.model,
        messages,
        temperature: target.temperature ?? 0.0, // Deterministic for command execution
        maxTokens: target.maxTokens
      });

      return this.successResult(result.text);
    } catch (error) {
      return this.errorResult(
        `${binding} bash execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
