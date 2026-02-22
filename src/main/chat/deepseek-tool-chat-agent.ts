import { resolveModelTarget, type AppConfig } from "../config";
import type { GenerateTextResult, ModelsFactory } from "../models";
import type { SandboxService } from "../sandbox";
import type { ChatSendInput, ChatSendResult, ChatUpdateStage } from "../../shared/ipc";
import { MAX_TOOL_STEPS } from "./chat-constants";
import { normalizeHistory } from "./history-utils";
import { parsePlannerAction } from "./planner-parser";
import type { ToolObservation } from "./planner-types";
import { buildFinalSystemPrompt, buildPlannerSystemPrompt } from "./prompts";
import { executePlannerTool } from "./tool-executor";
import { normalizeSpaces, truncate } from "./text-utils";

const buildStreamResult = (streamed: GenerateTextResult, latencyMs: number): ChatSendResult => {
  return {
    reply: streamed.text,
    provider: streamed.provider,
    model: streamed.model,
    latencyMs
  };
};

const throwIfAborted = (abortSignal?: AbortSignal): void => {
  if (abortSignal?.aborted) {
    throw new Error("Request cancelled by user");
  }
};

export class DeepSeekToolChatAgent {
  constructor(
    private readonly config: AppConfig,
    private readonly modelsFactory: ModelsFactory,
    private readonly sandboxService: SandboxService
  ) {}

  async send(
    input: ChatSendInput,
    onUpdate?: (stage: ChatUpdateStage, message: string) => void,
    onDelta?: (delta: string) => void,
    abortSignal?: AbortSignal
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
    let plannerDraftAnswer: string | undefined;

    throwIfAborted(abortSignal);
    onUpdate?.("planning", "正在规划是否需要调用工具...");

    for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
      throwIfAborted(abortSignal);
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
        ],
        abortSignal
      });

      accumulatedLatency += planner.latencyMs;
      const action = parsePlannerAction(planner.text);
      if (!action) {
        plannerDraftAnswer = planner.text;
        onUpdate?.("final", "Planner 返回非 JSON，进入流式回答阶段");
        break;
      }

      if (action.action === "answer") {
        plannerDraftAnswer = action.answer;
        onUpdate?.("final", "Planner 选择直接回答，进入流式回答阶段");
        break;
      }

      onUpdate?.("tool", `执行工具：${action.tool}${action.reason ? `（${normalizeSpaces(action.reason)}）` : ""}`);
      throwIfAborted(abortSignal);
      const observation = await executePlannerTool({
        action,
        config: this.config,
        sandboxService: this.sandboxService
      });
      observations.push(observation);
      onUpdate?.("tool", `${action.tool} -> ${observation.ok ? "success" : "failed"}: ${truncate(observation.output, 240)}`);
    }

    throwIfAborted(abortSignal);
    onUpdate?.("model", "进入最终总结阶段（基于工具观察结果）");

    const finalResponse = await this.modelsFactory.generateTextStream(
      {
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
          },
          ...(plannerDraftAnswer
            ? [
                {
                  role: "system" as const,
                  content: `Planner draft answer (for reference only): ${plannerDraftAnswer}`
                }
              ]
            : [])
        ],
        abortSignal
      },
      (delta) => {
        onDelta?.(delta);
      }
    );

    accumulatedLatency += finalResponse.latencyMs;
    onUpdate?.("final", "最终回答已生成");

    return buildStreamResult(finalResponse, accumulatedLatency);
  }
}
