type LogLevel = "debug" | "info" | "warn" | "error";

type LogModule =
  | "chat"
  | "pipeline"
  | "middleware"
  | "llm"
  | "memory"
  | "tool"
  | "openviking"
  | "system";

type LogContext = {
  traceId?: string;
  modelCallId?: string;
  phase?: string;
  durationMs?: number;
  msg: string;
  module: LogModule;
  extra?: Record<string, unknown>;
};

type LogEvent = LogContext & {
  level: LogLevel;
  ts: string;
};

const RESET = "\u001b[0m";
const BRIGHT = "\u001b[1m";
const DIM = "\u001b[2m";
const FG_RED = "\u001b[31m";
const FG_GREEN = "\u001b[32m";
const FG_YELLOW = "\u001b[33m";
const FG_BLUE = "\u001b[34m";
const FG_MAGENTA = "\u001b[35m";
const FG_CYAN = "\u001b[36m";
const FG_WHITE = "\u001b[37m";

const shouldUseColor = (): boolean => {
  const explicit = process.env.BANDRY_LOG_COLOR;
  if (explicit === "1" || explicit === "true") {
    return true;
  }
  if (explicit === "0" || explicit === "false") {
    return false;
  }

  if (process.env.NO_COLOR) {
    return false;
  }

  const forceColor = process.env.FORCE_COLOR;
  if (forceColor === "0") {
    return false;
  }
  if (forceColor && forceColor !== "0") {
    return true;
  }

  return Boolean(process.stdout.isTTY);
};

const moduleColor = (moduleName: LogModule): string => {
  switch (moduleName) {
    case "chat":
      return FG_WHITE;
    case "pipeline":
      return FG_CYAN;
    case "middleware":
      return FG_BLUE;
    case "llm":
      return FG_MAGENTA;
    case "memory":
      return FG_GREEN;
    case "tool":
      return FG_YELLOW;
    case "openviking":
      return FG_MAGENTA;
    case "system":
      return FG_WHITE;
    default:
      return FG_WHITE;
  }
};

const levelColor = (level: LogLevel): string => {
  switch (level) {
    case "error":
      return FG_RED;
    case "warn":
      return FG_YELLOW;
    case "debug":
      return FG_CYAN;
    case "info":
    default:
      return FG_WHITE;
  }
};

const formatClockTime = (date: Date): string => {
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mm = `${date.getMinutes()}`.padStart(2, "0");
  const ss = `${date.getSeconds()}`.padStart(2, "0");
  const ms = `${date.getMilliseconds()}`.padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
};

const toLogEvent = (level: LogLevel, context: LogContext): LogEvent => {
  return {
    level,
    ts: new Date().toISOString(),
    ...context,
  };
};

const formatExtra = (extra?: Record<string, unknown>): string => {
  if (!extra) {
    return "";
  }

  const parts = Object.entries(extra)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `${key}=${value}`;
      }
      return `${key}=${JSON.stringify(value)}`;
    });

  return parts.join(" ");
};

const formatPrettyLog = (event: LogEvent): string => {
  const timestamp = formatClockTime(new Date(event.ts));
  const level = event.level.toUpperCase();
  const moduleName = event.module.toUpperCase();
  const phase = event.phase ? `[${event.phase}]` : "";
  const trace = event.traceId ? `trace=${event.traceId}` : "";
  const call = event.modelCallId ? `call=${event.modelCallId}` : "";
  const duration =
    typeof event.durationMs === "number" ? `duration=${event.durationMs}ms` : "";
  const extra = formatExtra(event.extra);

  const headSegments = [
    `[${timestamp}]`,
    `[${level}]`,
    `[${moduleName}]`,
    phase,
    trace ? `[${trace}${call ? ` ${call}` : ""}]` : call ? `[${call}]` : "",
  ].filter(Boolean);

  const tailSegments = [event.msg, duration, extra].filter(Boolean);
  const raw = `${headSegments.join(" ")} ${tailSegments.join(" | ")}`.trim();

  if (!shouldUseColor()) {
    return raw;
  }

  const coloredHead = [
    `${DIM}[${timestamp}]${RESET}`,
    `${levelColor(event.level)}${BRIGHT}[${level}]${RESET}`,
    `${moduleColor(event.module)}${BRIGHT}[${moduleName}]${RESET}`,
    phase ? `${moduleColor(event.module)}${phase}${RESET}` : "",
    trace || call ? `${DIM}${trace ? `[${trace}${call ? ` ${call}` : ""}]` : `[${call}]`}${RESET}` : "",
  ].filter(Boolean);

  const coloredTail = `${moduleColor(event.module)}${event.msg}${RESET}`;
  const suffixParts = [duration, extra].filter(Boolean);
  if (suffixParts.length === 0) {
    return `${coloredHead.join(" ")} ${coloredTail}`;
  }

  return `${coloredHead.join(" ")} ${coloredTail} ${DIM}| ${suffixParts.join(" ")}${RESET}`;
};

const isJsonMode = (): boolean => process.env.BANDRY_LOG_JSON === "1";

const write = (event: LogEvent): void => {
  if (isJsonMode()) {
    const line = JSON.stringify(event);
    if (event.level === "error") {
      console.error(line);
      return;
    }
    if (event.level === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
    return;
  }

  const line = formatPrettyLog(event);
  if (event.level === "error") {
    console.error(line);
    return;
  }
  if (event.level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
};

const emit = (level: LogLevel, context: LogContext): void => {
  write(toLogEvent(level, context));
};

export const runtimeLogger = {
  debug(context: LogContext): void {
    emit("debug", context);
  },
  info(context: LogContext): void {
    emit("info", context);
  },
  warn(context: LogContext): void {
    emit("warn", context);
  },
  error(context: LogContext): void {
    emit("error", context);
  },
};

export type { LogModule };
