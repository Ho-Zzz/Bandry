import type { AppConfig, RuntimeRole } from "../../config";
import type { GenerateTextResult, ModelsFactory } from "../../llm/runtime";
import { resolveRuntimeTarget, type RuntimeModelTarget } from "../../llm/runtime/runtime-target";
import type { SandboxService } from "../../sandbox";
import type { ChatSendInput, ChatSendResult, ChatUpdateStage } from "../../../shared/ipc";
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

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const formatRoleBinding = (
  role: RuntimeRole,
  target: RuntimeModelTarget
): string => {
  return `${role} profile=${target.profileId} model=${target.provider}/${target.model}`;
};

export class ToolPlanningChatAgent {
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

    let plannerTarget: RuntimeModelTarget;
    let synthTarget: RuntimeModelTarget;
    try {
      plannerTarget = resolveRuntimeTarget(this.config, "lead.planner");
      synthTarget = resolveRuntimeTarget(this.config, "lead.synthesizer");
    } catch (error) {
      const messageWithRole = `LeadAgent 路由配置错误: ${getErrorMessage(error)}`;
      onUpdate?.("error", messageWithRole);
      throw new Error(messageWithRole);
    }

    if (!plannerTarget.runtimeConfig.apiKey.trim()) {
      const messageWithRole = `[${formatRoleBinding("lead.planner", plannerTarget)}] provider api key is missing`;
      onUpdate?.("error", messageWithRole);
      throw new Error(messageWithRole);
    }
    if (!synthTarget.runtimeConfig.apiKey.trim()) {
      const messageWithRole = `[${formatRoleBinding("lead.synthesizer", synthTarget)}] provider api key is missing`;
      onUpdate?.("error", messageWithRole);
      throw new Error(messageWithRole);
    }

    const history = normalizeHistory(input.history);
    const observations: ToolObservation[] = [];
    const attemptedToolSignatures = new Set<string>();
    let accumulatedLatency = 0;
    let plannerDraftAnswer: string | undefined;
    let failedToolCount = 0;

    throwIfAborted(abortSignal);
    onUpdate?.("planning", "正在规划是否需要调用工具...");

    for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
      throwIfAborted(abortSignal);
      onUpdate?.(
        "model",
        `规划步骤 ${step + 1}/${MAX_TOOL_STEPS}：请求 ${plannerTarget.provider}/${plannerTarget.model}`
      );

      let planner: GenerateTextResult;
      try {
        planner = await this.modelsFactory.generateText({
          runtimeConfig: plannerTarget.runtimeConfig,
          model: plannerTarget.model,
          temperature: plannerTarget.temperature ?? 0,
          maxTokens: plannerTarget.maxTokens,
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
      } catch (error) {
        const plannerError = `[${formatRoleBinding("lead.planner", plannerTarget)}] model call failed: ${getErrorMessage(error)}`;
        onUpdate?.("error", plannerError);
        throw new Error(plannerError);
      }

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

      const toolSignature = `${action.tool}:${JSON.stringify(action.input ?? {})}`;
      if (attemptedToolSignatures.has(toolSignature)) {
        onUpdate?.("final", "检测到重复工具调用，改为直接回答");
        break;
      }
      attemptedToolSignatures.add(toolSignature);

      onUpdate?.("tool", `执行工具：${action.tool}${action.reason ? `（${normalizeSpaces(action.reason)}）` : ""}`);
      throwIfAborted(abortSignal);
      const observation = await executePlannerTool({
        action,
        config: this.config,
        sandboxService: this.sandboxService
      });
      observations.push(observation);
      onUpdate?.("tool", `${action.tool} -> ${observation.ok ? "success" : "failed"}: ${truncate(observation.output, 240)}`);

      if (observation.ok) {
        continue;
      }

      failedToolCount += 1;
      const normalizedError = observation.output.toLowerCase();
      const shouldStopPlanning =
        failedToolCount >= 1 &&
        (observations.every((item) => !item.ok) ||
          normalizedError.includes("path does not exist") ||
          normalizedError.includes("invalid_path"));
      if (shouldStopPlanning) {
        onUpdate?.("final", "工具执行失败，改为直接回答（避免无效重试）");
        break;
      }
    }

    throwIfAborted(abortSignal);
    onUpdate?.(
      "model",
      observations.length > 0
        ? "进入最终总结阶段（基于工具观察结果）"
        : "进入直接回答阶段（无需工具）"
    );

    let finalResponse: GenerateTextResult;
    try {
      finalResponse = await this.modelsFactory.generateTextStream(
        {
          runtimeConfig: synthTarget.runtimeConfig,
          model: synthTarget.model,
          temperature: synthTarget.temperature ?? 0.2,
          maxTokens: synthTarget.maxTokens,
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
    } catch (error) {
      const synthError = `[${formatRoleBinding("lead.synthesizer", synthTarget)}] model call failed: ${getErrorMessage(error)}`;
      onUpdate?.("error", synthError);
      throw new Error(synthError);
    }

    accumulatedLatency += finalResponse.latencyMs;
    onUpdate?.("final", "最终回答已生成");

    return buildStreamResult(finalResponse, accumulatedLatency);
  }
}
