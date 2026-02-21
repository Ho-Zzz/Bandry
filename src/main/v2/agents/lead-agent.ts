import { resolveModelTarget, type AppConfig } from "../../config";
import type { ModelsFactory } from "../../models";
import { DAGScheduler } from "../scheduler";
import { WorkerPool } from "../workers";
import type { DAGPlan, AgentResult } from "./types";

/**
 * Lead Agent
 * Orchestrates multi-agent workflows
 * Plans DAG and delegates to sub-agents
 */
export class LeadAgent {
  private dagScheduler: DAGScheduler;
  private workerPool: WorkerPool;

  constructor(
    private config: AppConfig,
    private modelsFactory: ModelsFactory
  ) {
    this.workerPool = new WorkerPool(3); // Max 3 concurrent workers
    this.dagScheduler = new DAGScheduler(this.workerPool);
  }

  /**
   * Process user request with multi-agent delegation
   */
  async processRequest(input: {
    prompt: string;
    workspacePath: string;
  }): Promise<{
    plan: DAGPlan;
    results: Map<string, AgentResult>;
    summary: string;
  }> {
    // Step 1: Generate DAG plan
    const plan = await this.generateDAGPlan(input.prompt);

    // Step 2: Execute DAG
    const results = await this.dagScheduler.scheduleDAG(plan, input.workspacePath);

    // Step 3: Synthesize final response
    const summary = await this.synthesizeResponse(input.prompt, results);

    return { plan, results, summary };
  }

  /**
   * Generate DAG plan from user prompt
   */
  private async generateDAGPlan(prompt: string): Promise<DAGPlan> {
    const target = resolveModelTarget(this.config, "lead.planner");
    const providerConfig = this.config.providers[target.provider];
    const systemPrompt = `You are a Lead Agent responsible for planning multi-agent workflows.

Given a user request, break it down into a DAG (Directed Acyclic Graph) of sub-tasks.

Available agent roles:
- researcher: Read and analyze files (read-only)
- bash_operator: Execute shell commands
- writer: Write formatted output files

Output a JSON plan with this structure:
{
  "tasks": [
    {
      "subTaskId": "task_1",
      "agentRole": "researcher",
      "prompt": "Read and summarize the README file",
      "dependencies": [],
      "writePath": "staging/summary.md"
    },
    {
      "subTaskId": "task_2",
      "agentRole": "writer",
      "prompt": "Create a report based on the summary",
      "dependencies": ["task_1"],
      "writePath": "output/report.md"
    }
  ]
}

Rules:
1. Use dependencies to ensure correct execution order
2. Keep tasks focused and atomic
3. Use writePath to pass data between tasks
4. Avoid circular dependencies`;

    const result = await this.modelsFactory.generateText({
      runtimeConfig: {
        provider: target.provider,
        baseUrl: providerConfig.baseUrl,
        apiKey: providerConfig.apiKey,
        orgId: providerConfig.orgId
      },
      model: target.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: target.temperature ?? 0.7,
      maxTokens: target.maxTokens
    });

    // Parse JSON response
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const plan: DAGPlan = JSON.parse(jsonMatch[0]);

      // Validate plan
      if (!plan.tasks || !Array.isArray(plan.tasks)) {
        throw new Error("Invalid plan structure");
      }

      return plan;
    } catch (error) {
      throw new Error(
        `Failed to parse DAG plan: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Synthesize final response from sub-agent results
   */
  private async synthesizeResponse(
    originalPrompt: string,
    results: Map<string, AgentResult>
  ): Promise<string> {
    const target = resolveModelTarget(this.config, "lead.synthesizer");
    const providerConfig = this.config.providers[target.provider];
    const systemPrompt = `You are a Lead Agent synthesizing results from multiple sub-agents.

Provide a clear, concise summary of what was accomplished.`;

    const resultsText = Array.from(results.entries())
      .map(([taskId, result]) => {
        return `Task ${taskId}:
Success: ${result.success}
Output: ${result.output}
${result.error ? `Error: ${result.error}` : ""}
${result.artifacts ? `Artifacts: ${result.artifacts.join(", ")}` : ""}`;
      })
      .join("\n\n");

    const result = await this.modelsFactory.generateText({
      runtimeConfig: {
        provider: target.provider,
        baseUrl: providerConfig.baseUrl,
        apiKey: providerConfig.apiKey,
        orgId: providerConfig.orgId
      },
      model: target.model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Original request: ${originalPrompt}\n\nResults:\n${resultsText}\n\nProvide a summary:`
        }
      ],
      temperature: target.temperature ?? 0.3,
      maxTokens: target.maxTokens
    });

    return result.text;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.workerPool.terminateAll();
    this.dagScheduler.clear();
  }
}
