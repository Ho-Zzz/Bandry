/**
 * Copilot View Component
 *
 * Single-column ChatGPT-like interface for interacting with the AI agent.
 * Supports conversation persistence via route params.
 */

import { type ChangeEvent, type PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  type TextMessagePartProps,
  type ToolCallMessagePartProps
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger
} from "@heroui/react";
import {
  AlertCircle,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  Loader2,
  ListTodo,
  Maximize2,
  Minimize2,
  Paperclip,
  Plus,
  Send,
  Settings,
  Sparkles,
  Square,
  Trash2,
  User,
  Wrench
} from "lucide-react";
import { clsx } from "clsx";
import { useConversationStore } from "../../store/use-conversation-store";
import { useCopilotRuntime } from "../../features/copilot/use-copilot-runtime";

type TraceToolArgs = {
  stage?: string;
};

type TraceToolResult = {
  message?: string;
  timestamp?: number;
};

type ProcessKind = "Plan" | "Tool" | "Result";

type TraceItem = {
  id: string;
  kind: ProcessKind;
  stage: string;
  message: string;
  timestamp?: number;
  source?: string;
  status?: "success" | "failed";
};

type ToolResultSummary = {
  source: string;
  status: "success" | "failed";
  output: string;
  timestamp?: number;
};

type ProcessSectionType = "planning" | "execution" | "finalizing" | "error";

type ProcessSection = {
  id: string;
  type: ProcessSectionType;
  title: string;
  items: TraceItem[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const stageMeta = (stage?: string): { label: string; icon: typeof Brain; dotClass: string; toneClass: string } => {
  if (stage === "planning") {
    return {
      label: "Planning",
      icon: Sparkles,
      dotClass: "bg-sky-400",
      toneClass: "text-sky-700"
    };
  }

  if (stage === "tool") {
    return {
      label: "Running Tool",
      icon: Wrench,
      dotClass: "bg-amber-400",
      toneClass: "text-amber-700"
    };
  }

  if (stage === "model") {
    return {
      label: "Thinking",
      icon: Brain,
      dotClass: "bg-indigo-400",
      toneClass: "text-indigo-700"
    };
  }

  if (stage === "final") {
    return {
      label: "Finalizing",
      icon: CheckCircle2,
      dotClass: "bg-emerald-400",
      toneClass: "text-emerald-700"
    };
  }

  if (stage === "error") {
    return {
      label: "Error",
      icon: AlertCircle,
      dotClass: "bg-rose-400",
      toneClass: "text-rose-700"
    };
  }

  return {
    label: "Step",
    icon: Brain,
    dotClass: "bg-zinc-400",
    toneClass: "text-zinc-700"
  };
};

const formatDuration = (ms?: number): string | null => {
  if (!ms || ms < 0) {
    return null;
  }

  if (ms < 1000) {
    return `${ms} ms`;
  }

  return `${(ms / 1000).toFixed(1)} s`;
};

const formatTime = (timestamp?: number): string | null => {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp).toLocaleTimeString();
};

const truncateText = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
};

const resolveProcessKind = (stage: string, message: string): ProcessKind => {
  if (stage === "planning" || stage === "model") {
    return "Plan";
  }

  if (stage === "tool") {
    if (/[->]\s*(success|failed)\s*:/i.test(message)) {
      return "Result";
    }

    return "Tool";
  }

  return "Result";
};

const processKindBadgeClass = (kind: ProcessKind): string => {
  if (kind === "Plan") {
    return "bg-sky-100 text-sky-700";
  }

  if (kind === "Tool") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-emerald-100 text-emerald-700";
};

const extractTraceState = (
  toolName: string,
  args: unknown,
  result: unknown
): {
  stage: string;
  message?: string;
  timestamp?: number;
} => {
  const typedArgs: TraceToolArgs = isRecord(args)
    ? {
        stage: typeof args.stage === "string" ? args.stage : undefined
      }
    : {};

  const typedResult: TraceToolResult = isRecord(result)
    ? {
        message: typeof result.message === "string" ? result.message : undefined,
        timestamp: typeof result.timestamp === "number" ? result.timestamp : undefined
      }
    : {};

  return {
    stage: typedArgs.stage || toolName.replace(/^trace_/, "") || "trace",
    message: typedResult.message,
    timestamp: typedResult.timestamp
  };
};

const parseToolSource = (message: string): string | undefined => {
  const match = message.match(/^执行工具：([^\s（(]+)/);
  if (!match?.[1]) {
    return undefined;
  }

  return match[1];
};

const parseToolResult = (
  message: string
): {
  source: string;
  status: "success" | "failed";
  output: string;
} | null => {
  const match = message.match(/^([a-zA-Z0-9_.:-]+)\s*->\s*(success|failed)\s*:\s*([\s\S]*)$/i);
  if (!match) {
    return null;
  }

  const source = match[1]?.trim();
  const status = match[2]?.toLowerCase() === "failed" ? "failed" : "success";
  const output = match[3]?.trim() ?? "";

  if (!source) {
    return null;
  }

  return {
    source,
    status,
    output
  };
};

const tryFormatJson = (value: string): string | null => {
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

const extractTraceItems = (parts: readonly unknown[]): TraceItem[] => {
  const items: TraceItem[] = [];

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
    const { stage, message, timestamp } = extractTraceState(toolName, partRecord.args, partRecord.result);
    const normalizedMessage = message?.trim();

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
      status: parsedResult?.status
    });
  }

  return items;
};

const buildToolSummaries = (traceItems: TraceItem[]): ToolResultSummary[] => {
  const latestBySource = new Map<string, ToolResultSummary>();

  for (const item of traceItems) {
    const parsedResult = parseToolResult(item.message);
    if (!parsedResult) {
      continue;
    }

    latestBySource.set(parsedResult.source, {
      source: parsedResult.source,
      status: parsedResult.status,
      output: parsedResult.output,
      timestamp: item.timestamp
    });
  }

  return Array.from(latestBySource.values()).sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
};

const resolveSectionType = (item: TraceItem): ProcessSectionType => {
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

const buildSectionTitle = (type: ProcessSectionType, index: number): string => {
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

const buildProcessSections = (items: TraceItem[]): ProcessSection[] => {
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

const MessageTextPart = ({ text }: TextMessagePartProps) => {
  return <div className="whitespace-pre-wrap break-words">{text}</div>;
};

const AssistantTextPart = () => {
  return (
    <MarkdownTextPrimitive
      smooth={false}
      className="text-sm leading-7 text-zinc-900 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:text-blue-600 [&_a]:underline [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-zinc-900 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:my-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-zinc-200 [&_pre]:bg-zinc-100 [&_pre]:p-3 [&_pre]:text-zinc-900 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-zinc-900 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
    />
  );
};

const HiddenTracePart = (part: ToolCallMessagePartProps) => {
  void part;
  return null;
};

const HiddenTraceGroup = (group: PropsWithChildren<{ startIndex: number; endIndex: number }>) => {
  void group;
  return null;
};

const ToolResultLayer = ({ summaries }: { summaries: ToolResultSummary[] }) => {
  if (summaries.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 max-w-full space-y-2 overflow-hidden">
      <p className="text-xs font-medium text-zinc-500">生成资源与工具结果</p>
      {summaries.map((summary) => {
        const formattedJson = tryFormatJson(summary.output);
        const renderedOutput = truncateText(summary.output, 800);

        return (
          <div key={`${summary.source}-${summary.timestamp ?? "0"}`} className="max-w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-800">{summary.source}</span>
                <span
                  className={clsx(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                    summary.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  )}
                >
                  {summary.status}
                </span>
              </div>
              {summary.timestamp ? <span className="text-zinc-500">{formatTime(summary.timestamp)}</span> : null}
            </div>
            {formattedJson ? (
              <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-zinc-900 p-2 text-[11px] text-zinc-100">
                <code>{formattedJson}</code>
              </pre>
            ) : (
              <p className="mt-1 whitespace-pre-wrap break-all text-xs leading-5 text-zinc-700">{renderedOutput}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};

const ProcessLayer = ({ items, isRunning }: { items: TraceItem[]; isRunning: boolean }) => {
  const sections = useMemo(() => buildProcessSections(items), [items]);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const elapsed = useMemo(() => {
    const timestamps = items.map((item) => item.timestamp).filter((v): v is number => v !== undefined);
    if (timestamps.length < 2) {
      return null;
    }

    return formatDuration(Math.max(...timestamps) - Math.min(...timestamps));
  }, [items]);

  useEffect(() => {
    setOpenMap((previous) => {
      const next: Record<string, boolean> = {};
      sections.forEach((section, index) => {
        const isLast = index === sections.length - 1;
        if (isRunning && isLast) {
          next[section.id] = true;
          return;
        }

        next[section.id] = previous[section.id] ?? false;
      });
      return next;
    });
  }, [sections, isRunning]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 max-w-full space-y-2 overflow-hidden">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Brain size={12} />
        <span>思考与执行过程</span>
        <span>
          {items.length} 步
          {elapsed ? ` · ${elapsed}` : ""}
        </span>
      </div>

      {sections.map((section, sectionIndex) => {
        const sectionOpen = openMap[section.id] ?? false;
        const latest = section.items[section.items.length - 1];
        const isSectionRunning = isRunning && sectionIndex === sections.length - 1;
        const hasError = section.items.some((item) => item.status === "failed" || item.stage === "error");

        return (
          <div key={section.id} className="max-w-full overflow-hidden rounded-md border border-zinc-200 bg-zinc-50/70">
            <button
              type="button"
              onClick={() =>
                setOpenMap((previous) => ({
                  ...previous,
                  [section.id]: !sectionOpen
                }))
              }
              className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-zinc-100/80"
            >
              <div className="flex min-w-0 items-center gap-2">
                {isSectionRunning ? (
                  <Loader2 size={12} className="animate-spin text-indigo-500" />
                ) : hasError ? (
                  <AlertCircle size={12} className="text-rose-500" />
                ) : (
                  <CheckCircle2 size={12} className="text-emerald-500" />
                )}
                <span className="text-xs font-medium text-zinc-700">{section.title}</span>
                <span className="text-[11px] text-zinc-500">{section.items.length} steps</span>
              </div>
              <ChevronDown size={12} className={clsx("text-zinc-500 transition-transform", sectionOpen ? "rotate-180" : "rotate-0")} />
            </button>

            {sectionOpen ? (
              <div className="border-t border-zinc-200 px-3 py-2">
                <div className="min-w-0 space-y-1.5">
                  {section.items.map((item) => {
                    const meta = stageMeta(item.stage);
                    const StepIcon = meta.icon;
                    return (
                      <div key={item.id} className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                          <span className={clsx("rounded px-1.5 py-0.5 font-medium", processKindBadgeClass(item.kind))}>
                            {item.kind}
                          </span>
                          <StepIcon size={11} className={meta.toneClass} />
                          <span className="min-w-0 truncate">{item.source ?? meta.label}</span>
                          {item.timestamp ? <span className="text-zinc-400">{formatTime(item.timestamp)}</span> : null}
                        </div>
                        <div className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs leading-5 text-zinc-600 break-all">
                          {item.message}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="border-t border-zinc-200 px-3 py-1">
                <p className="truncate text-[11px] text-zinc-500">{latest?.message}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const SystemMessage = () => {
  return (
    <MessagePrimitive.Root className="my-4 flex justify-center">
      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600">
        <MessagePrimitive.Parts components={{ Text: MessageTextPart }} />
      </span>
    </MessagePrimitive.Root>
  );
};

const UserMessage = () => {
  return (
    <MessagePrimitive.Root className="mb-6 flex flex-row-reverse gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500">
        <User size={16} className="text-white" />
      </div>

      <div className="flex max-w-[70%] flex-col items-end gap-2">
        <div className="rounded-2xl bg-blue-500 px-4 py-3 text-sm text-white">
          <MessagePrimitive.Parts components={{ Text: MessageTextPart }} />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantMessage = () => {
  const status = useAuiState((s) => s.message.status);
  const parts = useAuiState((s) => s.message.parts);
  const statusType = status?.type;
  const isRunning = statusType === "running";

  const hasTextPart = useMemo(() => {
    return parts.some((part) => {
      if (!isRecord(part)) {
        return false;
      }

      if (part.type !== "text") {
        return false;
      }

      return typeof part.text === "string" && part.text.trim().length > 0;
    });
  }, [parts]);

  const traceItems = useMemo(() => extractTraceItems(parts), [parts]);
  const toolSummaries = useMemo(() => buildToolSummaries(traceItems), [traceItems]);
  const hasProcess = traceItems.length > 0;

  return (
    <MessagePrimitive.Root className="mb-6 flex min-w-0 flex-row gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200">
        <Bot size={16} className="text-gray-600" />
      </div>

      <div className="flex min-w-0 w-full max-w-[78%] flex-col items-start gap-2">
        {isRunning && !hasTextPart && !hasProcess ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              <span>Thinking...</span>
            </div>
          </div>
        ) : (
          <>
            <ProcessLayer items={traceItems} isRunning={isRunning} />
            <MessagePrimitive.Parts
              components={{
                Text: AssistantTextPart,
                tools: {
                  Fallback: HiddenTracePart
                },
                ToolGroup: HiddenTraceGroup
              }}
            />
            <ToolResultLayer summaries={toolSummaries} />
          </>
        )}

        {statusType === "incomplete" ? <span className="text-xs text-red-500">Failed to send</span> : null}
      </div>
    </MessagePrimitive.Root>
  );
};

const Message = () => {
  const role = useAuiState((s) => s.message.role);

  if (role === "user") {
    return <UserMessage />;
  }

  if (role === "system") {
    return <SystemMessage />;
  }

  return <AssistantMessage />;
};

export const Copilot = () => {
  const { conversationId: routeConversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const [isComposerToolsOpen, setIsComposerToolsOpen] = useState(false);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [isPlanModeEnabled, setIsPlanModeEnabled] = useState(false);
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { deleteConversation, fetchConversations } = useConversationStore();

  const { runtime, clearMessages, isLoading, conversationId, cancelCurrentRequest } = useCopilotRuntime({
    conversationId: routeConversationId
  });

  // Update URL when conversation is created
  useEffect(() => {
    if (conversationId && !routeConversationId) {
      navigate(`/copilot/${conversationId}`, { replace: true });
      void fetchConversations();
    }
  }, [conversationId, routeConversationId, navigate, fetchConversations]);

  const handleClearConversation = async () => {
    if (conversationId) {
      await deleteConversation(conversationId);
      await fetchConversations();
    }
    clearMessages();
    navigate("/copilot");
  };

  const handleCancelGeneration = async () => {
    await cancelCurrentRequest();
  };

  const handleChooseFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFileCount(event.target.files?.length ?? 0);
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-full w-full flex-col bg-white">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">Bandry Assistant</h1>
          </div>
          <div className="flex items-center gap-2">
            <Dropdown>
              <DropdownTrigger>
                <Button variant="light" size="sm" isIconOnly>
                  <Settings size={18} />
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Chat actions">
                <DropdownItem key="clear" startContent={<Trash2 size={14} />} onPress={handleClearConversation}>
                  Delete conversation
                </DropdownItem>
                <DropdownItem key="settings" startContent={<Settings size={14} />} href="/settings">
                  Settings
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>

        <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
          <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-6">
            <ThreadPrimitive.Empty>
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
                  <Bot size={40} className="text-blue-500" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-gray-900">How can I help you today?</h2>
                <p className="max-w-md text-gray-500">
                  Describe what you want to accomplish and I&apos;ll break it down into tasks and execute them for you.
                </p>
              </div>
            </ThreadPrimitive.Empty>

            <div className="mx-auto max-w-4xl">
              <ThreadPrimitive.Messages
                components={{
                  Message,
                  UserMessage,
                  AssistantMessage,
                  SystemMessage
                }}
              />
            </div>
          </ThreadPrimitive.Viewport>

          <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="mx-auto max-w-4xl">
              <ComposerPrimitive.Root className="relative">
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFilesChange} />

                {isComposerToolsOpen ? (
                  <div className="absolute bottom-[calc(100%+10px)] right-16 z-20 w-[260px] rounded-3xl border border-zinc-700/80 bg-zinc-900/95 p-2 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur">
                    <div className="space-y-1 rounded-2xl bg-zinc-800/70 p-2">
                      <button
                        type="button"
                        onClick={handleChooseFiles}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[17px] font-medium hover:bg-zinc-700/70"
                      >
                        <Paperclip size={18} className="text-zinc-300" />
                        <span>Add photos & files</span>
                        {selectedFileCount > 0 ? (
                          <span className="ml-auto rounded-full bg-zinc-700 px-2 py-0.5 text-xs">{selectedFileCount}</span>
                        ) : null}
                      </button>

                      <div className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-zinc-700/70">
                        <div className="flex items-center gap-3 text-[17px] font-medium">
                          <ListTodo size={18} className="text-zinc-300" />
                          <span>Plan mode</span>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isPlanModeEnabled}
                          onClick={() => setIsPlanModeEnabled((prev) => !prev)}
                          className={clsx(
                            "relative h-7 w-12 rounded-full transition-colors",
                            isPlanModeEnabled ? "bg-emerald-500" : "bg-zinc-600"
                          )}
                        >
                          <span
                            className={clsx(
                              "absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform",
                              isPlanModeEnabled ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div
                  className={clsx(
                    "flex items-end rounded-2xl border border-zinc-300 bg-white pl-3 pr-2",
                    isComposerExpanded ? "py-2" : "py-1.5"
                  )}
                >
                  <ComposerPrimitive.Input
                    placeholder="沟通时请保持“公开可接受”"
                    minRows={isComposerExpanded ? 4 : 1}
                    maxRows={isComposerExpanded ? 14 : 6}
                    submitMode="enter"
                    className={clsx(
                      "w-full resize-none bg-transparent py-1.5 text-sm outline-none ring-0 placeholder:text-zinc-400",
                      isComposerExpanded ? "max-h-[360px]" : "max-h-[140px]"
                    )}
                    disabled={isLoading}
                  />

                  <div className="mb-0.5 ml-2 flex items-center gap-1 border-l border-zinc-200 pl-2">
                    <Button
                      variant="light"
                      isIconOnly
                      className="h-8 w-8 text-zinc-600"
                      title="更多功能"
                      onPress={() => setIsComposerToolsOpen((prev) => !prev)}
                    >
                      <Plus size={16} />
                    </Button>

                    <Button
                      variant="light"
                      isIconOnly
                      className="h-8 w-8 text-zinc-600"
                      title={isComposerExpanded ? "收起输入框" : "展开输入框"}
                      onPress={() => setIsComposerExpanded((prev) => !prev)}
                    >
                      {isComposerExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    </Button>

                    {isLoading ? (
                      <Button
                        variant="flat"
                        isIconOnly
                        className="h-8 w-8 bg-zinc-800 text-white"
                        title="暂停生成"
                        onPress={() => {
                          void handleCancelGeneration();
                        }}
                      >
                        <Square size={13} className="fill-current" />
                      </Button>
                    ) : (
                      <ComposerPrimitive.Send asChild>
                        <Button color="primary" isIconOnly className="h-8 w-8" title="发送">
                          <Send size={16} />
                        </Button>
                      </ComposerPrimitive.Send>
                    )}
                  </div>
                </div>
              </ComposerPrimitive.Root>

              <div className="mt-2 flex items-center justify-center gap-1 text-xs text-gray-400">
                <span>Press Enter to send, Shift+Enter for new line</span>
                <ChevronDown size={12} />
              </div>
            </div>
          </div>
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  );
};
