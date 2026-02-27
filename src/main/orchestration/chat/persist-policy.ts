import path from "node:path";

export type PersistRequirement = {
  required: boolean;
  markdownPreferred: boolean;
};

export type PersistPathResolution =
  | {
      ok: true;
      path: string;
      explicit: boolean;
    }
  | {
      ok: false;
      code: "INVALID_PATH" | "PATH_NOT_ALLOWED" | "EXTENSION_NOT_ALLOWED";
      message: string;
      explicit: boolean;
    };

const ALLOWED_WRITE_EXTENSIONS = new Set([".md", ".txt", ".json", ".yaml", ".yml", ".csv"]);
const MAX_PERSIST_BYTES = 1024 * 1024;

const MARKDOWN_TOKEN = /(?:^|[^a-z0-9])md(?:[^a-z0-9]|$)|markdown|\.md\b/i;
const PERSIST_TOKEN = /保存|写入|写到|落盘|导出|输出到|to file|save to|write to|write file/i;
const DOC_TOKEN = /简报|报告|文档|report|brief|summary|document/i;
const FILE_TOKEN = /文件|file|路径|path|\.md\b|\.txt\b|\.json\b|\.ya?ml\b|\.csv\b/i;
const CREATE_TOKEN = /生成|产出|撰写|写一份|写个|写出|整理|create|draft|generate|produce|prepare/i;
const READ_TOKEN = /读取|查看|打开|浏览|看下|看看|review|read|open|inspect|look at/i;
const PATH_TOKEN = /([A-Za-z0-9_./-]+\.(?:md|markdown|txt|json|yaml|yml|csv))/i;

const pad2 = (value: number): string => String(value).padStart(2, "0");

const normalizeExtAlias = (value: string): string => {
  return value.replace(/\.markdown$/i, ".md");
};

export const detectPersistRequirement = (message: string): PersistRequirement => {
  const text = message.trim();
  const hasPath = PATH_TOKEN.test(text);
  const markdownPreferred = MARKDOWN_TOKEN.test(text);
  const explicitPersist = PERSIST_TOKEN.test(text);
  const referencesDocument = DOC_TOKEN.test(text);
  const referencesFile = FILE_TOKEN.test(text);
  const creationIntent = CREATE_TOKEN.test(text);
  const readIntent = READ_TOKEN.test(text);

  const explicitPersistRequest =
    explicitPersist && (hasPath || referencesFile || referencesDocument || markdownPreferred || creationIntent);
  const markdownDocGeneration = markdownPreferred && creationIntent && !readIntent;
  const required = explicitPersistRequest || markdownDocGeneration;

  return {
    required,
    markdownPreferred
  };
};

export const extractRequestedPath = (message: string): string | undefined => {
  const text = message.trim();
  if (!text) {
    return undefined;
  }

  const keywordMatch = text.match(
    /(?:保存到|写入到|写到|落盘到|导出到|输出到|save to|write to)\s*[`"']?([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)[`"']?/i
  );
  const candidate = keywordMatch?.[1] ?? text.match(PATH_TOKEN)?.[1];
  if (!candidate) {
    return undefined;
  }
  if (candidate.includes("://")) {
    return undefined;
  }

  return normalizeExtAlias(candidate.trim());
};

export const defaultPersistPath = (message: string, now: Date = new Date()): string => {
  const baseName = /简报|brief/i.test(message)
    ? "brief"
    : /报告|report/i.test(message)
      ? "report"
      : "document";
  const timestamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `output/${baseName}-${timestamp}.md`;
};

export const resolvePersistWritePath = (input: {
  requestedPath?: string;
  defaultPath: string;
  virtualRoot: string;
}): PersistPathResolution => {
  const explicit = Boolean(input.requestedPath?.trim());
  const sourcePath = normalizeExtAlias((input.requestedPath?.trim() || input.defaultPath.trim()).replaceAll("\\", "/"));

  if (!sourcePath || sourcePath.includes("\0") || /[\u0000-\u001f]/.test(sourcePath)) {
    return {
      ok: false,
      code: "INVALID_PATH",
      message: "Path is empty or contains invalid control characters.",
      explicit
    };
  }

  const normalizedVirtualRoot = input.virtualRoot.replace(/\/+$/, "");
  const outputRoot = `${normalizedVirtualRoot}/output`;
  const absolutePath = sourcePath.startsWith("/")
    ? path.posix.normalize(sourcePath)
    : path.posix.normalize(`${normalizedVirtualRoot}/${sourcePath.replace(/^\.\/+/, "")}`);

  if (!(absolutePath === outputRoot || absolutePath.startsWith(`${outputRoot}/`))) {
    return {
      ok: false,
      code: "PATH_NOT_ALLOWED",
      message: `Write path must be under ${outputRoot}.`,
      explicit
    };
  }

  const extension = path.posix.extname(absolutePath).toLowerCase();
  if (!ALLOWED_WRITE_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      code: "EXTENSION_NOT_ALLOWED",
      message: `Extension ${extension || "(none)"} is not allowed for write_file.`,
      explicit
    };
  }

  return {
    ok: true,
    path: absolutePath,
    explicit
  };
};

export const validatePersistContent = (content: string): string | undefined => {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > MAX_PERSIST_BYTES) {
    return `Content exceeds size limit (${MAX_PERSIST_BYTES} bytes).`;
  }
  return undefined;
};

export const isFileExistsObservation = (output: string): boolean => {
  const normalized = output.toLowerCase();
  return normalized.includes("file_exists") || normalized.includes("target file already exists");
};
