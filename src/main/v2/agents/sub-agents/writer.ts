import * as fs from "fs/promises";
import * as path from "path";
import { BaseAgent } from "../base-agent";
import { resolveModelTarget } from "../../../config";
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
    try {
      // Generate content using LLM
      const messages = input.messages || [
        { role: "system" as const, content: this.config.systemPrompt! },
        {
          role: "user" as const,
          content: `${input.prompt}\n\nWorkspace: ${input.workspacePath}`
        }
      ];
      const target = resolveModelTarget(this.appConfig, "sub.writer");
      const providerConfig = this.appConfig.providers[target.provider];

      const result = await this.modelsFactory.generateText({
        runtimeConfig: {
          provider: target.provider,
          baseUrl: providerConfig.baseUrl,
          apiKey: providerConfig.apiKey,
          orgId: providerConfig.orgId
        },
        model: target.model,
        messages,
        temperature: target.temperature ?? 0.3, // Slightly creative for writing
        maxTokens: target.maxTokens
      });

      // If writePath is specified, write the output
      if (input.writePath) {
        const fullPath = path.join(input.workspacePath, input.writePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, result.text, "utf8");

        return this.successResult(result.text, [input.writePath]);
      }

      return this.successResult(result.text);
    } catch (error) {
      return this.errorResult(
        `Writing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
