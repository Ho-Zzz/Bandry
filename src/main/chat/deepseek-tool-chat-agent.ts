import { resolveModelTarget, type AppConfig } from "../config";
import type { GenerateTextResult, ModelsFactory } from "../models";
import type { SandboxService } from "../sandbox";
import type { ChatSendInput, ChatSendResult, ChatUpdateStage } from "../../shared/ipc";
import { MAX_TOOL_STEPS } from "./chat-constants";
import { normalizeHistory, toModelMeta } from "./history-utils";
import { parsePlannerAction } from "./planner-parser";
import type { ToolObservation } from "./planner-types";
import { buildFinalSystemPrompt, buildPlannerSystemPrompt } from "./prompt-builders";
import { executePlannerTool } from "./tool-executor";
import { normalizeSpaces, truncate } from "./text-utils";

const buildPlannerResult = (planner: GenerateTextResult, reply: string): ChatSendResult => {
  return {
    reply,
    ...toModelMeta(planner)
  };
};

export class DeepSeekToolChatAgent {
  constructor(
    private readonly config: AppConfig,
    private readonly modelsFactory: ModelsFactory,
    private readonly sandboxService: SandboxService
  ) {}

  async send(
    input: ChatSendInput,
    onUpdate?: (stage: ChatUpdateStage, message: string) => void
  ): Promise<ChatSendResult> {
    const message = input.message.trim();
    if (!message) {
      throw new Error("message is required");
    }

    const target = resolveModelTarget(this.config, "chat.default", input.modelProfileId);
    const providerConfig = this.config.providers[target.provider];
    const runtimeConfig = {
      provider: target.provider,
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
      orgId: providerConfig.orgId
    };
    if (!providerConfig.apiKey.trim()) {
      throw new Error(`Provider ${target.provider} is not configured. Please set API key in Settings.`);
    }

    const history = normalizeHistory(input.history);
    const observations: ToolObservation[] = [];
    let accumulatedLatency = 0;

    onUpdate?.("planning", "正在规划是否需要调用工具...");

    for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
      onUpdate?.("model", `规划步骤 ${step + 1}/${MAX_TOOL_STEPS}：请求 ${target.provider}/${target.model}`);

      const planner = await this.modelsFactory.generateText({
        runtimeConfig,
        model: target.model,
        temperature: target.temperature ?? 0,
        maxTokens: target.maxTokens,
        messages: [
          {
            role: "system",
            content: buildPlannerSystemPrompt(this.config)
          },
          ...history,
          {
            role: "user",
            content: message
          },
          ...observations.map((observation, index) => ({
            role: "system" as const,
            content: `Tool observation #${index + 1}: ${JSON.stringify(observation)}`
          }))
        ]
      });

      accumulatedLatency += planner.latencyMs;
      const action = parsePlannerAction(planner.text);
      if (!action) {
        onUpdate?.("final", "Planner 返回非 JSON，直接使用模型回复");
        return buildPlannerResult(planner, planner.text);
      }

      if (action.action === "answer") {
        onUpdate?.("final", "Planner 选择直接回答");
        return buildPlannerResult(planner, action.answer);
      }

      onUpdate?.("tool", `执行工具：${action.tool}${action.reason ? `（${normalizeSpaces(action.reason)}）` : ""}`);
      const observation = await executePlannerTool({
        action,
        config: this.config,
        sandboxService: this.sandboxService
      });
      observations.push(observation);
      onUpdate?.("tool", `${action.tool} -> ${observation.ok ? "success" : "failed"}: ${truncate(observation.output, 240)}`);
    }

    onUpdate?.("model", "进入最终总结阶段（基于工具观察结果）");

    const finalResponse = await this.modelsFactory.generateText({
      runtimeConfig,
      model: target.model,
      temperature: target.temperature ?? 0.2,
      maxTokens: target.maxTokens,
      messages: [
        {
          role: "system",
          content: buildFinalSystemPrompt()
        },
        ...history,
        {
          role: "user",
          content: message
        },
        {
          role: "system",
          content: observations.map((observation, index) => `Observation #${index + 1}: ${JSON.stringify(observation)}`).join("\n")
        }
      ]
    });

    accumulatedLatency += finalResponse.latencyMs;
    onUpdate?.("final", "最终回答已生成");

    return {
      reply: finalResponse.text,
      provider: finalResponse.provider,
      model: finalResponse.model,
      latencyMs: accumulatedLatency
    };
  }
}
