import { BaseAgent } from "../base-agent";
import { resolveModelTarget } from "../../../config";
import type { AgentRole, AgentResult, AgentExecutionInput } from "../types";
import { RESEARCHER_AGENT_PROMPT } from "./prompts";

/**
 * Researcher Agent
 * Read-only research and analysis
 * Cannot write files or execute commands
 */
export class ResearcherAgent extends BaseAgent {
  protected getRole(): AgentRole {
    return "researcher";
  }

  protected getDefaultTools(): string[] {
    return ["read_local_file", "list_dir"];
  }

  protected getDefaultSystemPrompt(): string {
    return RESEARCHER_AGENT_PROMPT;
  }

  async execute(input: AgentExecutionInput): Promise<AgentResult> {
    try {
      // For now, use the LLM to process the research request
      // In a full implementation, this would:
      // 1. Parse the prompt to identify files to read
      // 2. Use tools to read those files
      // 3. Synthesize findings with LLM
      // 4. Return structured result

      const messages = input.messages || [
        { role: "system" as const, content: this.config.systemPrompt! },
        { role: "user" as const, content: input.prompt }
      ];
      const target = resolveModelTarget(this.appConfig, "sub.researcher");
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
        temperature: target.temperature ?? 0.2,
        maxTokens: target.maxTokens
      });

      return this.successResult(result.text);
    } catch (error) {
      return this.errorResult(
        `Research failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
