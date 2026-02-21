import { BaseAgent } from "../base-agent";
import { resolveModelTarget } from "../../../config";
import type { AgentRole, AgentResult, AgentExecutionInput } from "../types";

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
    return `You are a research agent. Your role is to:
- Read and analyze files
- Extract relevant information
- Summarize findings
- Answer questions based on available data

You have READ-ONLY access. You cannot:
- Write or modify files
- Execute commands
- Make network requests

Available tools:
- read_local_file: Read file contents
- list_dir: List directory contents

Provide clear, concise summaries of your findings.`;
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
