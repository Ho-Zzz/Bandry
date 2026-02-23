import { BaseAgent } from "../base-agent";
import { resolveRuntimeTarget } from "../../../../../llm/runtime/runtime-target";
import type { AgentRole, AgentResult, AgentExecutionInput } from "../types";
import { buildBashOperatorAgentPrompt } from "./prompts";

/**
 * Bash Operator Agent
 * Executes shell commands with strict sandboxing
 * Limited to workspace directory and allowed commands
 */
export class BashOperatorAgent extends BaseAgent {
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
      // For now, use the LLM to process the bash request
      // In a full implementation, this would:
      // 1. Parse the prompt to identify commands to run
      // 2. Validate commands against allowlist
      // 3. Execute commands via tools
      // 4. Capture and return outputs

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
