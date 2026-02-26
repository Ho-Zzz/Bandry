import * as fs from "fs/promises";
import * as path from "path";
import { BaseAgent } from "../base-agent";
import { resolveRuntimeTarget } from "../../../../../llm/runtime/runtime-target";
import type { AgentRole, AgentResult, AgentExecutionInput } from "../types";
import { WRITER_AGENT_PROMPT } from "./prompts";

/**
 * Writer Agent
 * Consolidates data and writes formatted output
 * No network or command execution access
 */
export class WriterAgent extends BaseAgent {
  protected getRole(): AgentRole {
    return "writer";
  }

  protected getDefaultTools(): string[] {
    return ["write_to_file", "read_local_file", "list_dir"];
  }

  protected getDefaultSystemPrompt(): string {
    return WRITER_AGENT_PROMPT;
  }

  async execute(input: AgentExecutionInput): Promise<AgentResult> {
    let binding = "[sub.writer]";
    try {
      // Generate content using LLM
      const messages = input.messages || [
        { role: "system" as const, content: this.config.systemPrompt! },
        {
          role: "user" as const,
          content: `${input.prompt}\n\nWorkspace: ${input.workspacePath}`
        }
      ];
      const target = resolveRuntimeTarget(this.appConfig, "sub.writer");
      binding = `[sub.writer profile=${target.profileId} model=${target.provider}/${target.model}]`;

      const result = await this.modelsFactory.generateText({
        runtimeConfig: target.runtimeConfig,
        model: target.model,
        messages,
        temperature: target.temperature ?? 0.3, // Slightly creative for writing
        maxTokens: target.maxTokens
      });

      // If writePath is specified, write the output
      if (input.writePath) {
        // Planner may pass a full virtual path (e.g. "/mnt/workspace/output/report.md")
        // instead of a relative path. Strip the virtual root prefix so path.join
        // produces the correct real path under workspacePath.
        const virtualRoot = this.appConfig.sandbox.virtualRoot.replace(/\/+$/, "");
        let relativePath = input.writePath;
        if (relativePath.startsWith(`${virtualRoot}/`)) {
          relativePath = relativePath.slice(virtualRoot.length + 1);
        } else if (relativePath.startsWith("/")) {
          relativePath = relativePath.slice(1);
        }

        const fullPath = path.join(input.workspacePath, relativePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, result.text, "utf8");

        return this.successResult(result.text, [relativePath]);
      }

      return this.successResult(result.text);
    } catch (error) {
      return this.errorResult(
        `${binding} writing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
