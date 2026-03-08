export type StepCopy = {
  running: string;
  success: string;
  failed?: string;
};

type ResolveStepCopyOptions = {
  thinkingMode?: boolean;
};

export type StepCopyKey =
  | "memory_search"
  | "web_search"
  | "github_search"
  | "web_fetch"
  | "read_file"
  | "list_dir"
  | "write_file"
  | "delegate_sub_tasks"
  | "default";

export const STEP_COPY: Record<StepCopyKey, StepCopy> = {
  memory_search: {
    running: "回忆中",
    success: "回忆完成"
  },
  web_search: {
    running: "搜索中",
    success: "搜索完成",
    failed: "搜索失败"
  },
  github_search: {
    running: "搜索 GitHub 中",
    success: "GitHub 搜索完成",
    failed: "GitHub 搜索失败"
  },
  web_fetch: {
    running: "读取网页中",
    success: "网页读取完成",
    failed: "网页读取失败"
  },
  read_file: {
    running: "查看文件中",
    success: "文件查看完成",
    failed: "文件查看失败"
  },
  list_dir: {
    running: "查看目录中",
    success: "目录查看完成",
    failed: "目录查看失败"
  },
  write_file: {
    running: "写入文件中",
    success: "文件写入完成",
    failed: "文件写入失败"
  },
  delegate_sub_tasks: {
    running: "执行子任务中",
    success: "子任务执行完成",
    failed: "子任务执行失败"
  },
  default: {
    running: "执行工具中",
    success: "工具执行完成",
    failed: "工具执行失败"
  }
};

const normalizeSource = (source: string): string => source.trim().toLowerCase();

export const resolveStepCopy = (source: string): StepCopy => {
  const normalized = normalizeSource(source);
  if (normalized === "github_search") {
    return STEP_COPY.github_search;
  }
  if (normalized === "memory_search") {
    return STEP_COPY.memory_search;
  }
  if (normalized === "web_search") {
    return STEP_COPY.web_search;
  }
  if (normalized === "web_fetch") {
    return STEP_COPY.web_fetch;
  }
  if (normalized === "read_file") {
    return STEP_COPY.read_file;
  }
  if (normalized === "list_dir") {
    return STEP_COPY.list_dir;
  }
  if (normalized === "write_file") {
    return STEP_COPY.write_file;
  }
  if (normalized.includes("delegate_sub_tasks") || normalized.includes("task")) {
    return STEP_COPY.delegate_sub_tasks;
  }

  return STEP_COPY.default;
};

export const resolveModeAwareStepCopy = (source: string, options?: ResolveStepCopyOptions): StepCopy => {
  const base = resolveStepCopy(source);
  if (!options?.thinkingMode) {
    return base;
  }

  const normalized = normalizeSource(source);

  if (normalized === "github_search") {
    return {
      ...base,
      running: "思考检索 GitHub 中"
    };
  }
  if (normalized === "memory_search") {
    return {
      ...base,
      running: "深度回忆中"
    };
  }
  if (normalized === "web_search") {
    return {
      ...base,
      running: "思考检索中"
    };
  }
  if (normalized === "web_fetch") {
    return {
      ...base,
      running: "思考读取网页中"
    };
  }
  return {
    ...base,
    running: `思考${base.running}`
  };
};
