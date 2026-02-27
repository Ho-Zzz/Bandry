import { randomUUID } from "node:crypto";
import type { AppConfig, RuntimeRole } from "../../config";
import type { GenerateTextResult, ModelsFactory } from "../../llm/runtime";
import { resolveRuntimeTarget, type RuntimeModelTarget } from "../../llm/runtime/runtime-target";
import type { MemoryProvider } from "../../memory/contracts/types";
import type { SandboxService } from "../../sandbox";
import type {
  ChatClarificationOption,
  ChatMode,
  ChatSendInput,
  ChatSendResult,
  ChatUpdatePayload,
  ChatUpdateStage
} from "../../../shared/ipc";
import type { ConversationStore } from "../../persistence/sqlite";
import { MAX_TOOL_STEPS } from "./chat-constants";
import { normalizeHistory } from "./history-utils";
import { parsePlannerAction } from "./planner-parser";
import {
  defaultPersistPath,
  detectPersistRequirement,
  extractRequestedPath,
  isFileExistsObservation,
  resolvePersistWritePath
} from "./persist-policy";
import type { ToolObservation } from "./planner-types";
import { createMiddlewarePipeline } from "./middleware";
import { buildFinalSystemPrompt, buildPlannerSystemPrompt } from "./prompts";
import { executePlannerTool } from "./tool-executor";
import { normalizeSpaces, truncate } from "./text-utils";

const buildStreamResult = (streamed: GenerateTextResult, latencyMs: number, workspacePath?: string): ChatSendResult => {
  return {
    reply: streamed.text,
    provider: streamed.provider,
    model: streamed.model,
    latencyMs,
    ...(workspacePath ? { workspacePath } : {})
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

const looksLikeJsonAction = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  return (
    trimmed.startsWith("{") ||
    /^```json/i.test(trimmed) ||
    trimmed.includes('"action"') ||
    trimmed.includes('"tool"')
  );
};

const extractJsonArray = (text: string): string | null => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const candidate = fenced[1].trim();
    if (candidate.startsWith("[") && candidate.endsWith("]")) {
      return candidate;
    }
  }

  const start = text.indexOf("[");
  if (start === -1) {
    return null;
  }
  const end = text.lastIndexOf("]");
  if (end <= start) {
    return null;
  }

  const candidate = text.slice(start, end + 1).trim();
  return candidate.startsWith("[") && candidate.endsWith("]") ? candidate : null;
};

const extractPersistedPath = (output: string): string | undefined => {
  const match = output.match(/path=([^\s,]+)/i);
  return match?.[1];
};

export class ToolPlanningChatAgent {
  private memoryProvider?: MemoryProvider;

  constructor(
    private readonly config: AppConfig,
    private readonly modelsFactory: ModelsFactory,
    private readonly sandboxService: SandboxService,
    private readonly conversationStore?: ConversationStore
  ) {}

  setMemoryProvider(provider: MemoryProvider | null): void {
    this.memoryProvider = provider ?? undefined;
  }

  private buildFallbackClarificationOptions(question: string): ChatClarificationOption[] {
    return [
      {
        label: "按默认假设继续",
        value: `请按合理默认假设继续执行。澄清问题：${question}`,
        recommended: true
      },
      {
        label: "先确认范围",
        value: `请先明确范围和边界后再继续。澄清问题：${question}`
      },
      {
        label: "最小可行输出",
        value: `请先给我最小可行结果，再迭代。澄清问题：${question}`
      }
    ];
  }

  private async generateClarificationOptions(params: {
    question: string;
    userMessage: string;
    plannerTarget: RuntimeModelTarget;
    abortSignal?: AbortSignal;
  }): Promise<ChatClarificationOption[]> {
    const fallback = this.buildFallbackClarificationOptions(params.question);
    try {
      const response = await this.modelsFactory.generateText({
        runtimeConfig: params.plannerTarget.runtimeConfig,
        model: params.plannerTarget.model,
        temperature: 0,
        maxTokens: 220,
        messages: [
          {
            role: "system",
            content: [
              "Generate exactly 3 clarification reply options for desktop chat UI.",
              "Return JSON array only. Each item must include label and value.",
              "Keep label <= 12 Chinese characters.",
              "Option 1 must be the recommended default."
            ].join(" ")
          },
          {
            role: "user",
            content: `User request: ${params.userMessage}\nClarification question: ${params.question}`
          }
        ],
        abortSignal: params.abortSignal
      });

      const jsonArray = extractJsonArray(response.text);
      if (!jsonArray) {
        return fallback;
      }

      const parsed = JSON.parse(jsonArray) as unknown;
      if (!Array.isArray(parsed)) {
        return fallback;
      }

      const options = parsed
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item))
        .map((item) => {
          const label = typeof item.label === "string" ? item.label.trim() : "";
          const value = typeof item.value === "string" ? item.value.trim() : "";
          return { label, value };
        })
        .filter((item) => item.label.length > 0 && item.value.length > 0)
        .slice(0, 3)
        .map((item, index) => ({
          ...item,
          recommended: index === 0
        }));

      if (options.length !== 3) {
        return fallback;
      }

      return options;
    } catch {
      return fallback;
    }
  }

  async send(
    input: ChatSendInput,
    onUpdate?: (stage: ChatUpdateStage, message: string, payload?: ChatUpdatePayload) => void,
    onDelta?: (delta: string) => void,
    abortSignal?: AbortSignal
  ): Promise<ChatSendResult> {
    const message = input.message.trim();
    if (!message) {
      throw new Error("message is required");
    }

    const mode: ChatMode = input.mode ?? "default";
    const persistRequirement = detectPersistRequirement(message);
    const requestedPersistPath = persistRequirement.required ? extractRequestedPath(message) : undefined;
    const defaultPersistTargetPath = defaultPersistPath(message, new Date());
    const resolvedPersistPath = persistRequirement.required
      ? resolvePersistWritePath({
          requestedPath: requestedPersistPath,
          defaultPath: defaultPersistTargetPath,
          virtualRoot: this.config.sandbox.virtualRoot
        })
      : undefined;
    const userSpecifiedPersistPath = Boolean(requestedPersistPath?.trim());
    let persistRequired = persistRequirement.required;
    let persistDone = false;
    let persistPathHint = resolvedPersistPath?.ok ? resolvedPersistPath.path : "";
    let persistedPath: string | undefined;

    const emitUpdate = (stage: ChatUpdateStage, updateMessage: string, payload?: ChatUpdatePayload): void => {
      onUpdate?.(stage, updateMessage, payload);
    };

    // Log mode for debugging
    emitUpdate("planning", `Mode: ${mode}`);

    let plannerTarget: RuntimeModelTarget;
    let synthTarget: RuntimeModelTarget;
    try {
      plannerTarget = resolveRuntimeTarget(this.config, "lead.planner");
      synthTarget = resolveRuntimeTarget(this.config, "lead.synthesizer");
    } catch (error) {
      const messageWithRole = `LeadAgent 路由配置错误: ${getErrorMessage(error)}`;
      emitUpdate("error", messageWithRole);
      throw new Error(messageWithRole);
    }

    if (!plannerTarget.runtimeConfig.apiKey.trim()) {
      const messageWithRole = `[${formatRoleBinding("lead.planner", plannerTarget)}] provider api key is missing`;
      emitUpdate("error", messageWithRole);
      throw new Error(messageWithRole);
    }
    if (!synthTarget.runtimeConfig.apiKey.trim()) {
      const messageWithRole = `[${formatRoleBinding("lead.synthesizer", synthTarget)}] provider api key is missing`;
      emitUpdate("error", messageWithRole);
      throw new Error(messageWithRole);
    }

    const history = normalizeHistory(input.history);
    const pipeline = createMiddlewarePipeline({
      config: this.config,
      modelsFactory: this.modelsFactory,
      sandboxService: this.sandboxService,
      conversationStore: this.conversationStore,
      memoryProvider: this.memoryProvider,
      mode
    });
    let middlewareCtx = await pipeline.runBeforeAgent({
      sessionId: input.requestId?.trim() || randomUUID(),
      taskId: randomUUID(),
      conversationId: input.conversationId,
      workspacePath: "",
      messages: [],
      tools: [],
      metadata: {},
      state: "before_agent",
      chatMode: mode,
      runtime: {
        config: this.config,
        modelsFactory: this.modelsFactory,
        sandboxService: this.sandboxService,
        conversationStore: this.conversationStore,
        onUpdate: emitUpdate,
        abortSignal
      }
    });
    const observations: ToolObservation[] = [];
    const attemptedToolSignatures = new Set<string>();
    let accumulatedLatency = 0;
    let plannerDraftAnswer: string | undefined;
    let clarificationFinalReply: string | undefined;
    let failedToolCount = 0;

    throwIfAborted(abortSignal);

    // Emit workspace path early so the renderer can resolve file paths
    // before the chat response completes.
    if (middlewareCtx.workspacePath) {
      emitUpdate("planning", "工作空间已就绪", { workspacePath: middlewareCtx.workspacePath });
    }

    if (persistRequired && resolvedPersistPath && !resolvedPersistPath.ok && userSpecifiedPersistPath) {
      const question = `检测到你指定了文件路径 "${requestedPersistPath}"，但当前仅允许写入 /mnt/workspace/output/ 且仅支持文本扩展名（.md/.txt/.json/.yaml/.yml/.csv）。请提供新的输出路径。`;
      const options: ChatClarificationOption[] = [
        {
          label: "用默认路径",
          value: `请保存到 ${defaultPersistTargetPath}`,
          recommended: true
        },
        {
          label: "指定 output 路径",
          value: "请使用 /mnt/workspace/output/ 下的新路径保存"
        },
        {
          label: "先仅聊天输出",
          value: "先给出内容草稿，稍后我再指定保存路径"
        }
      ];
      clarificationFinalReply = `需要进一步确认：${question}`;
      emitUpdate("clarification", question, {
        clarification: {
          question,
          options
        }
      });
      emitUpdate("final", "等待用户澄清，已暂停后续执行");
    }

    if (persistRequired && resolvedPersistPath?.ok) {
      persistPathHint = resolvedPersistPath.path;
    }

    emitUpdate("planning", "正在规划是否需要调用工具...");

    for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
      if (clarificationFinalReply) {
        break;
      }
      throwIfAborted(abortSignal);
      emitUpdate(
        "model",
        `规划步骤 ${step + 1}/${MAX_TOOL_STEPS}：请求 ${plannerTarget.provider}/${plannerTarget.model}`
      );

      let planner: GenerateTextResult;
      try {
        const plannerMessages = [
          {
            role: "system" as const,
            content: buildPlannerSystemPrompt(this.config, {
              mode,
              userMessage: message,
              persistRequired,
              persistPathHint
            })
          },
          ...history,
          {
            role: "user" as const,
            content: message
          },
          ...observations.map((observation, index) => ({
            role: "system" as const,
            content: `Tool observation #${index + 1}: ${JSON.stringify(observation)}`
          }))
        ];

        const plannerCtx = await pipeline.executeModel(
          {
            ...middlewareCtx,
            messages: plannerMessages,
            llmResponse: undefined
          },
          async (ctx) => {
            const result = await this.modelsFactory.generateText({
              runtimeConfig: plannerTarget.runtimeConfig,
              model: plannerTarget.model,
              temperature: plannerTarget.temperature ?? 0,
              maxTokens: plannerTarget.maxTokens,
              messages: ctx.messages,
              abortSignal
            });
            return {
              ...ctx,
              llmResponse: {
                content: result.text
              },
              metadata: {
                ...ctx.metadata,
                plannerProvider: result.provider,
                plannerModel: result.model
              }
            };
          }
        );
        planner = {
          provider: plannerCtx.metadata.plannerProvider as GenerateTextResult["provider"],
          model: plannerCtx.metadata.plannerModel as string,
          text: plannerCtx.llmResponse?.content ?? "",
          latencyMs: 0
        };
        middlewareCtx = plannerCtx;
      } catch (error) {
        const plannerError = `[${formatRoleBinding("lead.planner", plannerTarget)}] model call failed: ${getErrorMessage(error)}`;
        emitUpdate("error", plannerError);
        throw new Error(plannerError);
      }

      accumulatedLatency += planner.latencyMs;
      const action = parsePlannerAction(planner.text);
      if (!action) {
        if (!looksLikeJsonAction(planner.text)) {
          plannerDraftAnswer = planner.text;
        }
        if (persistRequired && !persistDone) {
          observations.push({
            tool: "write_file",
            input: { path: persistPathHint || defaultPersistTargetPath },
            ok: false,
            output: "PERSIST_REQUIRED: Must call write_file successfully before final answer."
          });
          emitUpdate("planning", "检测到请求要求落盘，继续规划 write_file 步骤");
          continue;
        }
        emitUpdate("final", "Planner 返回非结构化输出，进入流式回答阶段");
        break;
      }

      if (action.action === "answer") {
        if (persistRequired && !persistDone) {
          plannerDraftAnswer = action.answer;
          observations.push({
            tool: "write_file",
            input: { path: persistPathHint || defaultPersistTargetPath },
            ok: false,
            output: "PERSIST_REQUIRED: Answer deferred until write_file succeeds."
          });
          emitUpdate("planning", "请求要求先落盘，已阻止直接回答并继续规划");
          continue;
        }
        plannerDraftAnswer = action.answer;
        emitUpdate("final", "Planner 选择直接回答，进入流式回答阶段");
        break;
      }

      if (action.tool === "ask_clarification") {
        const question = action.input?.question?.trim() || "请补充更多上下文，以便继续执行。";
        const options = await this.generateClarificationOptions({
          question,
          userMessage: message,
          plannerTarget,
          abortSignal
        });
        clarificationFinalReply = `需要进一步确认：${question}`;
        emitUpdate("clarification", question, {
          clarification: {
            question,
            options
          }
        });
        emitUpdate("final", "等待用户澄清，已暂停后续执行");
        break;
      }

      if (persistRequired && action.tool === "write_file" && (!action.input?.path || !action.input.path.trim())) {
        action.input = {
          ...(action.input ?? {}),
          path: persistPathHint || defaultPersistTargetPath
        };
      }

      const toolSignature = `${action.tool}:${JSON.stringify(action.input ?? {})}`;
      if (attemptedToolSignatures.has(toolSignature)) {
        emitUpdate("final", "检测到重复工具调用，改为直接回答");
        break;
      }
      attemptedToolSignatures.add(toolSignature);

      emitUpdate("tool", `执行工具：${action.tool}${action.reason ? `（${normalizeSpaces(action.reason)}）` : ""}`);
      throwIfAborted(abortSignal);
      const observation = await pipeline.executeToolCall(
        middlewareCtx,
        action,
        async (ctx, wrappedAction) =>
          await executePlannerTool({
            action: wrappedAction,
            config: this.config,
            sandboxService: this.sandboxService,
            workspacePath: ctx.workspacePath,
            onDelegationUpdate: (detail) => emitUpdate("tool", detail),
            abortSignal,
            memoryProvider: this.memoryProvider,
            sessionId: middlewareCtx.sessionId
          })
      );
      observations.push(observation);
      emitUpdate("tool", `${action.tool} -> ${observation.ok ? "success" : "failed"}: ${truncate(observation.output, 240)}`);

      if (action.tool === "write_file" && observation.ok) {
        persistDone = true;
        persistedPath = extractPersistedPath(observation.output) ?? action.input?.path;
      }

      if (
        persistRequired &&
        action.tool === "write_file" &&
        !observation.ok &&
        userSpecifiedPersistPath &&
        isFileExistsObservation(observation.output)
      ) {
        const conflictPath = action.input?.path ?? persistPathHint ?? requestedPersistPath ?? defaultPersistTargetPath;
        const question = `目标文件已存在：${conflictPath}。当前策略不允许覆盖，请提供新的 output 路径。`;
        const options = await this.generateClarificationOptions({
          question,
          userMessage: message,
          plannerTarget,
          abortSignal
        });
        clarificationFinalReply = `需要进一步确认：${question}`;
        emitUpdate("clarification", question, {
          clarification: {
            question,
            options
          }
        });
        emitUpdate("final", "检测到写入冲突，等待用户提供新路径");
        break;
      }

      if (observation.ok) {
        if (action.tool === "delegate_sub_tasks") {
          emitUpdate("final", "委派任务执行完成，进入最终总结阶段");
          break;
        }
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
        emitUpdate("final", "工具执行失败，改为直接回答（避免无效重试）");
        break;
      }
    }

    throwIfAborted(abortSignal);
    if (!clarificationFinalReply) {
      emitUpdate(
        "model",
        observations.length > 0
          ? "进入最终总结阶段（基于工具观察结果）"
          : "进入直接回答阶段（无需工具）"
      );
    }

    let finalResponse: GenerateTextResult;
    if (clarificationFinalReply) {
      finalResponse = {
        provider: synthTarget.provider,
        model: synthTarget.model,
        text: clarificationFinalReply,
        latencyMs: 0
      };
      middlewareCtx = await pipeline.runAfterAgent({
        ...middlewareCtx,
        finalResponse: finalResponse.text
      });
    } else {
      try {
        const finalMessages = [
          {
            role: "system" as const,
            content: buildFinalSystemPrompt()
          },
          ...history,
          {
            role: "user" as const,
            content: message
          },
          {
            role: "system" as const,
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
        ];

        const finalCtx = await pipeline.executeModel(
          {
            ...middlewareCtx,
            messages: finalMessages
          },
          async (ctx) => {
            const streamed = await this.modelsFactory.generateTextStream(
              {
                runtimeConfig: synthTarget.runtimeConfig,
                model: synthTarget.model,
                temperature: synthTarget.temperature ?? 0.2,
                maxTokens: synthTarget.maxTokens,
                messages: ctx.messages,
                abortSignal
              },
              (delta) => {
                onDelta?.(delta);
              }
            );

            return {
              ...ctx,
              llmResponse: {
                content: streamed.text
              },
              metadata: {
                ...ctx.metadata,
                synthProvider: streamed.provider,
                synthModel: streamed.model,
                synthLatencyMs: streamed.latencyMs,
                synthUsage: streamed.usage
              }
            };
          }
        );
        finalResponse = {
          provider: finalCtx.metadata.synthProvider as GenerateTextResult["provider"],
          model: finalCtx.metadata.synthModel as string,
          text: finalCtx.llmResponse?.content ?? "",
          latencyMs: (finalCtx.metadata.synthLatencyMs as number | undefined) ?? 0,
          usage: finalCtx.metadata.synthUsage as GenerateTextResult["usage"]
        };
        middlewareCtx = await pipeline.runAfterAgent({
          ...finalCtx,
          finalResponse: finalResponse.text
        });
        if (middlewareCtx.metadata.summarizationApplied) {
          emitUpdate(
            "model",
            `summarization applied: ${String(middlewareCtx.metadata.summarizationOriginalMessages ?? "?")} -> ${String(middlewareCtx.metadata.summarizationKeptMessages ?? "?")}`
          );
        }
      } catch (error) {
        const synthError = `[${formatRoleBinding("lead.synthesizer", synthTarget)}] model call failed: ${getErrorMessage(error)}`;
        emitUpdate("error", synthError);
        throw new Error(synthError);
      }
    }

    if (persistRequired && !persistDone && !clarificationFinalReply) {
      emitUpdate("tool", "未满足落盘约束，执行后端兜底 write_file...");
      const fallbackPath = defaultPersistPath(message, new Date());
      const fallbackResolved = resolvePersistWritePath({
        defaultPath: fallbackPath,
        virtualRoot: this.config.sandbox.virtualRoot
      });
      if (!fallbackResolved.ok) {
        const fallbackError = `PERSIST_FALLBACK_FAILED: ${fallbackResolved.message}`;
        emitUpdate("error", fallbackError);
        throw new Error(fallbackError);
      }

      try {
        const writeResult = await this.sandboxService.writeFile({
          path: fallbackResolved.path,
          content: finalResponse.text,
          createDirs: true,
          overwrite: false
        });
        persistDone = true;
        persistedPath = writeResult.path;
        observations.push({
          tool: "write_file",
          input: {
            path: writeResult.path,
            overwrite: false
          },
          ok: true,
          output: `Wrote file successfully: path=${writeResult.path}, bytes=${writeResult.bytesWritten}`
        });
        emitUpdate("tool", `write_file -> success: path=${writeResult.path}`);
      } catch (error) {
        const fallbackError = `PERSIST_FALLBACK_FAILED: ${getErrorMessage(error)}`;
        emitUpdate("error", fallbackError);
        throw new Error(fallbackError);
      }
    }

    if (persistRequired && persistDone && persistedPath && !clarificationFinalReply) {
      finalResponse = {
        ...finalResponse,
        text: `${finalResponse.text}\n\n已保存到文件：${persistedPath}`
      };
    }

    accumulatedLatency += finalResponse.latencyMs;
    emitUpdate("final", "最终回答已生成");

    return buildStreamResult(finalResponse, accumulatedLatency, middlewareCtx.workspacePath || undefined);
  }
}
