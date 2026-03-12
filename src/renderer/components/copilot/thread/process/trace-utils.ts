import { parseToolResult } from "../../../../features/copilot/trace-paths";
import type { ChatMode } from "../../../../../shared/ipc";
import { resolveModeAwareStepCopy } from "./process-step-copy";

type TraceToolArgs = {
  stage?: string;
};

type TraceToolResult = {
  message?: string;
  timestamp?: number;
  workspacePath?: string;
  toolResult?: {
    source?: string;
    status?: "loading" | "success" | "failed";
    output?: string;
    artifacts?: string[];
    workspacePath?: string;
  };
};

export type ProcessKind = "Plan" | "Tool" | "Result";

export type TraceItem = {
  id: string;
  kind: ProcessKind;
  stage: string;
  message: string;
  timestamp?: number;
  source?: string;
  status?: "success" | "failed";
  workspacePath?: string;
  toolResult?: TraceToolResult["toolResult"];
};

export type ToolResultSummary = {
  source: string;
  status: "success" | "failed" | "loading";
  output: string;
  timestamp?: number;
  workspacePath?: string;
  sources: SourceItem[];
  artifacts: string[];
};

export type SourceItem = {
  id: string;
  url: string;
  title: string;
};

export type ProcessSectionType = "planning" | "execution" | "finalizing" | "error";

export type ProcessSection = {
  id: string;
  type: ProcessSectionType;
  title: string;
  items: TraceItem[];
};

export type ProcessDisplayState = {
  isRunning: boolean;
  mode?: ChatMode;
  thinkingEnabled?: boolean;
};

export type ProcessStep = {
  id: string;
  label: string;
  tone: "active" | "pending" | "error";
};

export type ProcessLineIcon =
  | "memory"
  | "search"
  | "web"
  | "file"
  | "write"
  | "tool"
  | "answer"
  | "subagent"
  | "error";

export type ProcessLineStatus = "running" | "success" | "failed";

export type ProcessLineItem = {
  id: string;
  status: ProcessLineStatus;
  icon: ProcessLineIcon;
  title: string;
  detail?: string;
  timestamp?: number;
};

type BuildProcessLineItemsOptions = {
  mode?: ChatMode;
  thinkingEnabled?: boolean;
};

const hasSameLine = (lines: ProcessLineItem[], candidate: ProcessLineItem): boolean => {
  return lines.some((line) => line.icon === candidate.icon && line.title === candidate.title && line.status === candidate.status);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const extractTraceState = (
  toolName: string,
  args: unknown,
  result: unknown
): {
  stage: string;
  message?: string;
  timestamp?: number;
  workspacePath?: string;
  toolResult?: TraceToolResult["toolResult"];
} => {
  const typedArgs: TraceToolArgs = isRecord(args)
    ? {
        stage: typeof args.stage === "string" ? args.stage : undefined
      }
    : {};

  const typedResult: TraceToolResult = isRecord(result)
    ? {
        message: typeof result.message === "string" ? result.message : undefined,
        timestamp: typeof result.timestamp === "number" ? result.timestamp : undefined,
        workspacePath: typeof result.workspacePath === "string" ? result.workspacePath : undefined,
        toolResult: isRecord(result.toolResult)
          ? {
              source: typeof result.toolResult.source === "string" ? result.toolResult.source : undefined,
              status:
                result.toolResult.status === "loading" ||
                result.toolResult.status === "success" ||
                result.toolResult.status === "failed"
                  ? result.toolResult.status
                  : undefined,
              output: typeof result.toolResult.output === "string" ? result.toolResult.output : undefined,
              artifacts: Array.isArray(result.toolResult.artifacts)
                ? result.toolResult.artifacts.filter((item): item is string => typeof item === "string")
                : undefined,
              workspacePath: typeof result.toolResult.workspacePath === "string" ? result.toolResult.workspacePath : undefined
            }
          : undefined
      }
    : {};

  return {
    stage: typedArgs.stage || toolName.replace(/^trace_/, "") || "trace",
    message: typedResult.message,
    timestamp: typedResult.timestamp,
    workspacePath: typedResult.workspacePath,
    toolResult: typedResult.toolResult
  };
};

const parseToolSource = (message: string): string | undefined => {
  const match = message.match(/^执行工具：([^\s（(]+)/);
  if (!match?.[1]) {
    return undefined;
  }

  return match[1];
};

export const formatDuration = (ms?: number): string | null => {
  if (!ms || ms < 0) {
    return null;
  }

  if (ms < 1000) {
    return `${ms} ms`;
  }

  return `${(ms / 1000).toFixed(1)} s`;
};

export const resolveProcessStatusLabel = ({
  isRunning,
  mode,
  thinkingEnabled
}: ProcessDisplayState): string => {
  if (!isRunning) {
    return "Reasoning";
  }

  if (mode === "thinking" || thinkingEnabled) {
    return "Thinking";
  }

  if (mode === "subagents") {
    return "Coordinating";
  }

  return "Generating";
};

const isTraceNoise = (message: string): boolean => {
  return (
    message.startsWith("Mode:") ||
    message.startsWith("Thinking enabled:") ||
    message.startsWith("Thinking fallback:") ||
    message.startsWith("规划步骤 ") ||
    message.startsWith("summarization ")
  );
};

const summarizeToolResultDetail = (source: string, status: "success" | "failed", output: string): string => {
  if (status === "failed") {
    if (source === "web_search") {
      return "搜索失败，改为直接回答";
    }
    if (source === "web_fetch") {
      return "页面读取失败";
    }
    if (source === "read_file") {
      return "文件读取失败";
    }
    if (source === "write_file") {
      return "文件写入失败";
    }
    return `${source} 执行失败`;
  }

  if (source === "web_search") {
    const urls = extractUrlsFromText(output);
    return urls.length > 0 ? `已找到 ${urls.length} 条候选来源` : "已完成信息搜索";
  }

  if (source === "web_fetch") {
    return "已读取页面内容";
  }

  if (source === "read_file") {
    return "已查看文件内容";
  }

  if (source === "list_dir") {
    return "已检查目录内容";
  }

  if (source === "write_file") {
    return "已写入结果文件";
  }

  if (source === "memory_search") {
    return "已补充相关记忆";
  }

  if (source === "delegate_sub_tasks") {
    return "已完成并行子任务";
  }

  return `${source} 已完成`;
};

const resolveToolIcon = (source: string): ProcessLineIcon => {
  const normalized = source.trim().toLowerCase();
  if (normalized.includes("memory")) {
    return "memory";
  }
  if (normalized.includes("search")) {
    return "search";
  }
  if (normalized.includes("fetch") || normalized.includes("browse")) {
    return "web";
  }
  if (normalized.includes("read_file") || normalized.includes("list_dir")) {
    return "file";
  }
  if (normalized.includes("write_file")) {
    return "write";
  }
  if (normalized.includes("sub") || normalized.includes("delegate")) {
    return "subagent";
  }
  return "tool";
};

const buildToolStartDetail = (message: string): string | undefined => {
  const reasonMatch = message.match(/[（(]([^()（）]+)[）)]\s*$/);
  const reason = reasonMatch?.[1]?.trim();
  if (!reason) {
    return undefined;
  }
  return truncateText(reason, 120);
};

const isAnswerPreparationMessage = (message: string): boolean => {
  return (
    message.includes("进入直接回答阶段") ||
    message.includes("进入最终总结阶段") ||
    message.includes("整理工具结果并准备回答") ||
    message.includes("整理思路并准备回答") ||
    message.includes("准备回答")
  );
};

const toCompletedTitle = (title: string): string => {
  return /中$/.test(title) ? `${title.replace(/中$/, "")}完成` : title;
};

const normalizePlanningLine = (
  item: TraceItem,
  options?: BuildProcessLineItemsOptions
): { icon: ProcessLineIcon; title: string; detail?: string; status: ProcessLineStatus } | null => {
  const message = item.message.trim();
  if (!message || isTraceNoise(message)) {
    return null;
  }

  if (message.includes("回忆")) {
    return {
      icon: "memory",
      title: "回忆中",
      status: "running"
    };
  }

  if (isAnswerPreparationMessage(message)) {
    return null;
  }

  const thinkingMode = options?.mode === "thinking" || options?.thinkingEnabled === true;
  if (thinkingMode && (message.includes("分析问题") || message.includes("整理思路") || message.includes("思考"))) {
    return {
      icon: "memory",
      title: "思考中",
      status: "running"
    };
  }

  return null;
};

export const buildProcessLineItems = (
  items: TraceItem[],
  isRunning: boolean,
  options?: BuildProcessLineItemsOptions
): ProcessLineItem[] => {
  const lines: ProcessLineItem[] = [];
  const runningToolIndex = new Map<string, number>();
  const thinkingMode = options?.mode === "thinking" || options?.thinkingEnabled === true;
  const finalizeRunningLines = (): void => {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line || line.status !== "running") {
        continue;
      }
      lines[index] = {
        ...line,
        status: "success",
        title: toCompletedTitle(line.title)
      };
    }
  };

  for (const item of items) {
    const message = item.message.trim();
    if (!message || isTraceNoise(message)) {
      continue;
    }

    if (item.stage === "error") {
      const errorLine: ProcessLineItem = {
        id: `${item.id}-error`,
        icon: "error",
        title: "执行失败",
        detail: truncateText(message, 140),
        status: "failed",
        timestamp: item.timestamp
      };
      if (!hasSameLine(lines, errorLine)) {
        lines.push(errorLine);
      }
      continue;
    }

    if (item.stage === "final" && message.includes("最终回答已生成")) {
      finalizeRunningLines();
      continue;
    }

    const parsedResult = parseToolResult(message);
    if (parsedResult) {
      const existingIndex = runningToolIndex.get(parsedResult.source);
      const copy = resolveModeAwareStepCopy(parsedResult.source, { thinkingMode });
      const nextLine: ProcessLineItem = {
        id: `${item.id}-${parsedResult.source}-result`,
        icon: resolveToolIcon(parsedResult.source),
        title: parsedResult.status === "failed" ? (copy.failed ?? "执行失败") : copy.success,
        detail: summarizeToolResultDetail(parsedResult.source, parsedResult.status, parsedResult.output),
        status: parsedResult.status === "failed" ? "failed" : "success",
        timestamp: item.timestamp
      };

      if (existingIndex !== undefined) {
        lines[existingIndex] = nextLine;
      } else {
        if (!hasSameLine(lines, nextLine)) {
          lines.push(nextLine);
        }
      }
      runningToolIndex.delete(parsedResult.source);
      continue;
    }

    if (item.stage === "tool" || item.stage === "subagent") {
      const source = item.source ?? parseToolSource(message);
      if (!source) {
        continue;
      }
      const copy = resolveModeAwareStepCopy(source, { thinkingMode });
      finalizeRunningLines();
      const nextLine: ProcessLineItem = {
        id: `${item.id}-${source}-start`,
        icon: resolveToolIcon(source),
        title: copy.running,
        status: "running",
        timestamp: item.timestamp
      };
      const reasonDetail = buildToolStartDetail(message);
      if (reasonDetail) {
        nextLine.detail = reasonDetail;
      }
      runningToolIndex.set(source, lines.length);
      if (!hasSameLine(lines, nextLine)) {
        lines.push(nextLine);
      }
      continue;
    }

    if (item.stage === "planning" || item.stage === "model") {
      if (isAnswerPreparationMessage(message)) {
        finalizeRunningLines();
        continue;
      }
      const normalized = normalizePlanningLine(item, options);
      if (!normalized) {
        continue;
      }
      if (normalized.title === "思考中" && lines.some((line) => line.title === "思考中")) {
        continue;
      }
      const nextPlanningLine: ProcessLineItem = {
        id: `${item.id}-planning`,
        ...normalized,
        timestamp: item.timestamp
      };
      if (!hasSameLine(lines, nextPlanningLine)) {
        lines.push(nextPlanningLine);
      }
    }
  }

  if (!isRunning && lines.length > 0) {
    return lines.map((line) => {
      if (line.status !== "running") {
        return line;
      }
      const isToolLike = line.icon === "memory" || line.icon === "search" || line.icon === "web" || line.icon === "file" || line.icon === "write" || line.icon === "tool" || line.icon === "subagent";
      if (isToolLike && /中$/.test(line.title)) {
        return {
          ...line,
          title: `${line.title.replace(/中$/, "")}完成`,
          status: "success"
        };
      }
      return {
        ...line,
        status: "success"
      };
    });
  }

  return lines;
};

const resolveStepLabel = (item: TraceItem, statusLabel: string): string | null => {
  const message = item.message.trim();
  if (!message || isTraceNoise(message)) {
    return null;
  }

  if (message.includes("回忆")) {
    return "回忆";
  }

  if (
    message.includes("进入直接回答阶段") ||
    message.includes("进入最终总结阶段") ||
    message.includes("Planner 已直接产出最终回答") ||
    message.includes("最终回答已生成")
  ) {
    return "回答";
  }

  if (item.stage === "tool" || item.stage === "subagent") {
    const toolSource = parseToolResult(message)?.source ?? item.source ?? parseToolSource(message);
    return toolSource ?? "工具";
  }

  if (item.stage === "planning" || item.stage === "model") {
    return statusLabel;
  }

  if (item.stage === "error") {
    return "异常";
  }

  return null;
};

export const buildProcessSteps = (
  items: TraceItem[],
  isRunning: boolean,
  statusLabel: string
): ProcessStep[] => {
  const labels: string[] = [statusLabel];

  for (const item of items) {
    const label = resolveStepLabel(item, statusLabel);
    if (!label) {
      continue;
    }

    if (labels[labels.length - 1] === label) {
      continue;
    }

    labels.push(label);
  }

  return labels.slice(0, 6).map((label, index, all) => ({
    id: `${label}-${index}`,
    label,
    tone:
      items.some((item) => item.stage === "error" || item.status === "failed") && index === all.length - 1
        ? "error"
        : isRunning && index === all.length - 1
          ? "active"
          : "pending"
  }));
};

export const resolveLatestProcessDetail = (items: TraceItem[]): string | null => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const message = items[index]?.message?.trim();
    if (!message || isTraceNoise(message)) {
      continue;
    }

    const parsedResult = parseToolResult(message);
    if (parsedResult) {
      return summarizeToolResultDetail(parsedResult.source, parsedResult.status, parsedResult.output);
    }

    return truncateText(message, 120);
  }

  return null;
};

export const formatTime = (timestamp?: number): string | null => {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp).toLocaleTimeString();
};

export const truncateText = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
};

export const tryFormatJson = (value: string): string | null => {
  const normalized = value.trim();
  if (!(normalized.startsWith("{") || normalized.startsWith("["))) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
};

export const resolveProcessKind = (stage: string, message: string): ProcessKind => {
  if (stage === "planning" || stage === "model") {
    return "Plan";
  }

  if (stage === "tool" || stage === "subagent") {
    if (/[->]\s*(success|failed|completed)\s*:/i.test(message)) {
      return "Result";
    }

    return "Tool";
  }

  return "Result";
};

export const processKindBadgeClass = (kind: ProcessKind): string => {
  if (kind === "Plan") {
    return "bg-sky-100 text-sky-700";
  }

  if (kind === "Tool") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-emerald-100 text-emerald-700";
};

export const extractTraceItems = (parts: readonly unknown[]): TraceItem[] => {
  const items: TraceItem[] = [];
  let messageWorkspacePath: string | undefined;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!isRecord(part)) {
      continue;
    }

    if (part.type !== "tool-call") {
      continue;
    }

    const partRecord = part as Record<string, unknown>;
    const toolName = typeof partRecord.toolName === "string" ? partRecord.toolName : "";
    const { stage, message, timestamp, workspacePath, toolResult } = extractTraceState(toolName, partRecord.args, partRecord.result);
    const normalizedMessage = message?.trim();
    if (workspacePath || toolResult?.workspacePath) {
      messageWorkspacePath = workspacePath ?? toolResult?.workspacePath;
    }

    if (!normalizedMessage) {
      continue;
    }

    const parsedResult = parseToolResult(normalizedMessage);
    const source = parsedResult?.source ?? parseToolSource(normalizedMessage);

    items.push({
      id: `trace-${index}-${timestamp ?? index}`,
      kind: resolveProcessKind(stage, normalizedMessage),
      stage,
      message: normalizedMessage,
      timestamp,
      source,
      status: parsedResult?.status,
      workspacePath: workspacePath ?? toolResult?.workspacePath,
      toolResult
    });
  }

  if (!messageWorkspacePath) {
    return items;
  }

  return items.map((item) => ({
    ...item,
    workspacePath: item.workspacePath ?? messageWorkspacePath
  }));
};

export const buildToolSummaries = (traceItems: TraceItem[], isRunning: boolean): ToolResultSummary[] => {
  const summaries: ToolResultSummary[] = [];
  const pendingBySource = new Map<string, TraceItem>();

  for (const item of traceItems) {
    if (item.toolResult?.source && item.toolResult.status) {
      const output = item.toolResult.output ?? item.message;
      const urls = extractUrlsFromText(output);
      const sources = isSearchLikeName(item.toolResult.source)
        ? urls.map((url, index) => ({
            id: `${item.toolResult?.source}-${index}-${url}-${item.timestamp ?? index}`,
            url,
            title: toSourceTitle(url)
          }))
        : [];

      summaries.push({
        source: item.toolResult.source,
        status: item.toolResult.status,
        output,
        timestamp: item.timestamp,
        workspacePath: item.toolResult.workspacePath ?? item.workspacePath,
        sources,
        artifacts: item.toolResult.artifacts ?? []
      });
      pendingBySource.delete(item.toolResult.source);
      continue;
    }

    const parsedResult = parseToolResult(item.message);
    if (parsedResult) {
      const urls = extractUrlsFromText(parsedResult.output);
      const sources = isSearchLikeName(parsedResult.source)
        ? urls.map((url, index) => ({
            id: `${parsedResult.source}-${index}-${url}-${item.timestamp ?? index}`,
            url,
            title: toSourceTitle(url)
          }))
        : [];

      summaries.push({
        source: parsedResult.source,
        status: parsedResult.status,
        output: parsedResult.output,
        timestamp: item.timestamp,
        workspacePath: item.workspacePath,
        sources,
        artifacts: []
      });
      pendingBySource.delete(parsedResult.source);
      continue;
    }

    const source = item.source ?? parseToolSource(item.message);
    if (!source) {
      continue;
    }

    if (item.kind === "Tool") {
      pendingBySource.set(source, item);
    }
  }

  if (isRunning) {
    pendingBySource.forEach((item, source) => {
      summaries.push({
        source,
        status: "loading",
        output: item.message,
        timestamp: item.timestamp,
        workspacePath: item.workspacePath,
        sources: [],
        artifacts: []
      });
    });
  }

  return summaries.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
};

export const resolveSectionType = (item: TraceItem): ProcessSectionType => {
  if (item.stage === "error") {
    return "error";
  }

  if (item.stage === "final") {
    return "finalizing";
  }

  if (item.kind === "Tool" || item.kind === "Result") {
    return "execution";
  }

  return "planning";
};

export const buildSectionTitle = (type: ProcessSectionType, index: number): string => {
  if (type === "planning") {
    return index > 1 ? `规划分析 ${index}` : "规划分析";
  }

  if (type === "execution") {
    return index > 1 ? `执行过程 ${index}` : "执行过程";
  }

  if (type === "finalizing") {
    return index > 1 ? `结果整理 ${index}` : "结果整理";
  }

  return index > 1 ? `异常处理 ${index}` : "异常处理";
};

const normalizeUrl = (value: string): string => {
  return value.replace(/[),.;!?]+$/g, "");
};

const extractUrlsFromText = (value: string): string[] => {
  const urls = new Set<string>();
  const urlRegex = /https?:\/\/[^\s<>"'`]+/g;
  const markdownLinkRegex = /\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g;

  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlRegex.exec(value)) !== null) {
    const candidate = urlMatch[0];
    if (!candidate) {
      continue;
    }
    urls.add(normalizeUrl(candidate));
  }

  let markdownMatch: RegExpExecArray | null;
  while ((markdownMatch = markdownLinkRegex.exec(value)) !== null) {
    const candidate = markdownMatch[1];
    if (!candidate) {
      continue;
    }
    urls.add(normalizeUrl(candidate));
  }

  return Array.from(urls);
};

const toSourceTitle = (url: string): string => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname}${path}`.slice(0, 80);
  } catch {
    return url.slice(0, 80);
  }
};

const SEARCH_TOOL_PATTERNS = [
  "search",
  "web",
  "browse",
  "crawl",
  "scrape",
  "source",
  "duckduckgo",
  "google"
];

const isSearchLikeName = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return SEARCH_TOOL_PATTERNS.some((pattern) => normalized.includes(pattern));
};

export const hasSearchLikeToolActivity = (parts: readonly unknown[]): boolean => {
  for (const part of parts) {
    if (!isRecord(part)) {
      continue;
    }

    if (part.type === "source") {
      return true;
    }

    if (part.type !== "tool-call") {
      continue;
    }

    const toolName = typeof part.toolName === "string" ? part.toolName : "";
    if (isSearchLikeName(toolName)) {
      return true;
    }

    if (!isRecord(part.result)) {
      continue;
    }

    const message = typeof part.result.message === "string" ? part.result.message : "";
    const parsedResult = message ? parseToolResult(message) : null;
    const source = parsedResult?.source ?? (message ? parseToolSource(message) : undefined);
    if (source && isSearchLikeName(source)) {
      return true;
    }
  }

  return false;
};

export const buildSourcesFromParts = (parts: readonly unknown[]): SourceItem[] => {
  const seen = new Set<string>();
  const sources: SourceItem[] = [];

  const collect = (text: string) => {
    extractUrlsFromText(text).forEach((url) => {
      if (seen.has(url)) {
        return;
      }
      seen.add(url);
      sources.push({
        id: `source-${sources.length}-${url}`,
        url,
        title: toSourceTitle(url)
      });
    });
  };

  parts.forEach((part) => {
    if (!isRecord(part)) {
      return;
    }

    if (part.type === "text" && typeof part.text === "string") {
      collect(part.text);
      return;
    }

    if (part.type !== "tool-call") {
      return;
    }

    if (!isRecord(part.result)) {
      return;
    }

    const message = part.result.message;
    if (typeof message === "string") {
      collect(message);
    }
  });

  return sources.slice(0, 8);
};

export const buildProcessSections = (items: TraceItem[]): ProcessSection[] => {
  const sections: ProcessSection[] = [];
  let current: ProcessSection | null = null;
  const sectionCounter: Record<ProcessSectionType, number> = {
    planning: 0,
    execution: 0,
    finalizing: 0,
    error: 0
  };

  for (const item of items) {
    const type = resolveSectionType(item);
    if (!current || current.type !== type) {
      sectionCounter[type] += 1;
      current = {
        id: `${type}-${sections.length}`,
        type,
        title: buildSectionTitle(type, sectionCounter[type]),
        items: []
      };
      sections.push(current);
    }

    current.items.push(item);
  }

  return sections;
};
