import { BaseAgent } from "../base-agent";
import { resolveModelTarget } from "../../../config";
import type { AgentRole, AgentResult, AgentExecutionInput } from "../types";

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
    return `You are a bash operator agent. Your role is to:
- Execute shell commands safely
- Perform file operations
- Run scripts and utilities
- Report command outputs

You are restricted to:
- Workspace directory only
- Allowed commands: ${this.appConfig.sandbox.allowedCommands.join(", ")}
- No network access outside workspace

Available tools:
- execute_bash: Run shell commands
- read_local_file: Read files
- list_dir: List directories
- write_to_file: Write files

Always validate commands before execution. Report errors clearly.`;
  }

  async execute(input: AgentExecutionInput): Promise<AgentResult> {
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
      const target = resolveModelTarget(this.appConfig, "sub.bash_operator");
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
        temperature: target.temperature ?? 0.0, // Deterministic for command execution
        maxTokens: target.maxTokens
      });

      return this.successResult(result.text);
    } catch (error) {
      return this.errorResult(
        `Bash execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
