import type { AppConfig } from "../../../config";
import type { GenerateTextResult, ModelsFactory } from "../../../models";
import { resolveRuntimeTarget } from "../../../models/runtime-target";
import { DAGScheduler } from "../scheduler";
import { WorkerPool } from "../workers";
import type { DAGPlan, AgentResult } from "./types";

/**
 * Lead Agent
 * Orchestrates multi-agent workflows
 * Plans DAG and delegates to sub-agents
 */
import { DAG_PLANNER_PROMPT, RESPONSE_SYNTHESIZER_PROMPT } from "./prompts";

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

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
    const results = await this.dagScheduler.scheduleDAG(plan, input.workspacePath, this.config);

    // Step 3: Synthesize final response
    const summary = await this.synthesizeResponse(input.prompt, results);

    return { plan, results, summary };
  }

  /**
   * Generate DAG plan from user prompt
   */
  private async generateDAGPlan(prompt: string): Promise<DAGPlan> {
    const target = resolveRuntimeTarget(this.config, "lead.planner");
    const systemPrompt = DAG_PLANNER_PROMPT;

    let result: GenerateTextResult;
    try {
      result = await this.modelsFactory.generateText({
        runtimeConfig: target.runtimeConfig,
        model: target.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature: target.temperature ?? 0.7,
        maxTokens: target.maxTokens
      });
    } catch (error) {
      throw new Error(
        `[lead.planner profile=${target.profileId} model=${target.provider}/${target.model}] model call failed: ${getErrorMessage(error)}`
      );
    }

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
    const target = resolveRuntimeTarget(this.config, "lead.synthesizer");
    const systemPrompt = RESPONSE_SYNTHESIZER_PROMPT;

    const resultsText = Array.from(results.entries())
      .map(([taskId, result]) => {
        return `Task ${taskId}:
Success: ${result.success}
Output: ${result.output}
${result.error ? `Error: ${result.error}` : ""}
${result.artifacts ? `Artifacts: ${result.artifacts.join(", ")}` : ""}`;
      })
      .join("\n\n");

    let result: GenerateTextResult;
    try {
      result = await this.modelsFactory.generateText({
        runtimeConfig: target.runtimeConfig,
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
    } catch (error) {
      throw new Error(
        `[lead.synthesizer profile=${target.profileId} model=${target.provider}/${target.model}] model call failed: ${getErrorMessage(error)}`
      );
    }

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
