import { describe, it, expect } from "vitest";
import { detectLanguage, getLanguageHint } from "../prompts/language-detector";
import { applyTemplate, buildSection, joinSections } from "../prompts/template-engine";
import { TOOL_CATALOG, getToolGuidance, getToolsByPriority } from "../prompts/tool-catalog";
import { buildPlannerSystemPrompt, buildFinalSystemPrompt } from "../prompts";
import type { AppConfig } from "../../../config";
import { MODEL_PROVIDER_DEFAULTS, MODEL_PROVIDERS } from "../../../../shared/model-providers";

const createMockProviders = (): AppConfig["providers"] => {
  const providers = Object.fromEntries(
    MODEL_PROVIDERS.map((provider) => {
      const defaults = MODEL_PROVIDER_DEFAULTS[provider];
      return [
        provider,
        {
          enabled: false,
          apiKey: "",
          baseUrl: defaults.baseUrl,
          model: defaults.model,
          embeddingModel: defaults.embeddingModel,
          ...(defaults.orgId !== undefined ? { orgId: defaults.orgId } : {})
        }
      ];
    })
  ) as AppConfig["providers"];

  providers.deepseek = {
    ...providers.deepseek,
    enabled: true,
    apiKey: "test-key",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat"
  };
  providers.openai = {
    ...providers.openai,
    enabled: false,
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4"
  };
  providers.volcengine = {
    ...providers.volcengine,
    enabled: false,
    apiKey: "",
    baseUrl: "",
    model: ""
  };

  return providers;
};

// Minimal mock config for testing
const createMockConfig = (overrides?: Partial<AppConfig>): AppConfig => ({
  llm: {
    defaultProvider: "deepseek",
    defaultModel: "deepseek-chat",
    timeoutMs: 30000,
    maxRetries: 3,
    retryBaseMs: 1000,
    rateLimitRps: 10,
    networkMode: "auto",
    offlineNonModelOnly: false,
    auditLogEnabled: false,
    piiRedactionEnabled: false
  },
  sandbox: {
    virtualRoot: "/mnt/workspace",
    allowedWorkspaces: ["/mnt/workspace"],
    allowedCommands: ["ls", "cat", "git"],
    execTimeoutMs: 30000,
    maxOutputBytes: 100000,
    auditLogEnabled: false
  },
  subagent: {
    maxConcurrent: 3,
    timeoutMs: 900000
  },
  providers: createMockProviders(),
  features: {
    enableMemory: false,
    enableMCP: false,
    enableSkills: false,
    enableSoul: false
  },
  openviking: {
    enabled: false,
    host: "localhost",
    port: 8080,
    apiKey: "",
    vlmProfileId: "default",
    embeddingProfileId: "default",
    serverCommand: "",
    serverArgs: [],
    startTimeoutMs: 10000,
    healthcheckIntervalMs: 5000,
    memoryTopK: 5,
    memoryScoreThreshold: 0.7,
    commitDebounceMs: 1000,
    targetUris: []
  },
  catalog: {
    source: {
      type: "file",
      location: "",
      schema: "models.dev",
      timeoutMs: 5000
    }
  },
  modelProfiles: [],
  routing: {
    assignments: {
      "chat.default": "default",
      "lead.planner": "default",
      "lead.synthesizer": "default",
      "sub.researcher": "default",
      "sub.bash_operator": "default",
      "sub.writer": "default",
      "memory.fact_extractor": "default"
    }
  },
  tools: {
    webSearch: {
      enabled: true,
      provider: "tavily",
      apiKey: "test-key",
      baseUrl: "https://api.tavily.com",
      timeoutMs: 10000,
      maxResults: 5
    },
    webFetch: {
      enabled: true,
      provider: "jina",
      apiKey: "test-key",
      baseUrl: "https://r.jina.ai",
      timeoutMs: 10000
    },
    githubSearch: {
      enabled: true,
      apiKey: "",
      baseUrl: "https://api.github.com",
      timeoutMs: 10000,
      maxResults: 10
    }
  },
  paths: {
    projectRoot: "/test",
    bandryHome: "/test/.bandry",
    configDir: "/test/.bandry/config",
    logsDir: "/test/.bandry/logs",
    workspaceDir: "/test/workspace",
    workspacesDir: "/test/workspaces",
    resourcesDir: "/test/resources",
    pluginsDir: "/test/plugins",
    traceDir: "/test/traces",
    skillsDir: "/test/skills",
    soulDir: "/test/soul",
    projectConfigPath: "/test/bandry.config.json",
    userConfigPath: "/test/.bandry/config/user.json",
    auditLogPath: "/test/.bandry/logs/audit.log",
    sandboxAuditLogPath: "/test/.bandry/logs/sandbox-audit.log",
    databasePath: "/test/.bandry/data.db",
    dotenvPath: "/test/.env"
  },
  channels: {
    enabled: false,
    channels: []
  },
  runtime: {
    inheritedEnv: {}
  },
  ...overrides
});

describe("language-detector", () => {
  it("detects Chinese text", () => {
    expect(detectLanguage("搜索 GitHub 上的 AI 项目")).toBe("zh");
    expect(detectLanguage("你好，请帮我查找文件")).toBe("zh");
  });

  it("detects English text", () => {
    expect(detectLanguage("Search for AI projects on GitHub")).toBe("en");
    expect(detectLanguage("Hello, please help me find files")).toBe("en");
  });

  it("returns auto for mixed or empty text", () => {
    expect(detectLanguage("")).toBe("auto");
    expect(detectLanguage("   ")).toBe("auto");
  });

  it("provides correct language hints", () => {
    expect(getLanguageHint("zh")).toContain("Chinese");
    expect(getLanguageHint("en")).toContain("English");
    expect(getLanguageHint("auto")).toContain("same language");
  });
});

describe("template-engine", () => {
  it("applies template variables", () => {
    const template = "Hello {name}, you have {count} messages.";
    const result = applyTemplate(template, { name: "Alice", count: 5 });
    expect(result).toBe("Hello Alice, you have 5 messages.");
  });

  it("keeps unknown placeholders", () => {
    const template = "Hello {name}, {unknown} placeholder.";
    const result = applyTemplate(template, { name: "Bob" });
    expect(result).toBe("Hello Bob, {unknown} placeholder.");
  });

  it("builds XML-style sections", () => {
    const section = buildSection("role", "You are an assistant.");
    expect(section).toBe("<role>\nYou are an assistant.\n</role>");
  });

  it("returns empty string for empty content", () => {
    expect(buildSection("empty", "")).toBe("");
    expect(buildSection("empty", "   ")).toBe("");
  });

  it("joins sections with double newlines", () => {
    const result = joinSections("<a>1</a>", "", "<b>2</b>");
    expect(result).toBe("<a>1</a>\n\n<b>2</b>");
  });
});

describe("tool-catalog", () => {
  it("contains expected tools", () => {
    expect(TOOL_CATALOG.has("github_search")).toBe(true);
    expect(TOOL_CATALOG.has("web_search")).toBe(true);
    expect(TOOL_CATALOG.has("list_dir")).toBe(true);
    expect(TOOL_CATALOG.has("write_file")).toBe(true);
  });

  it("returns tool guidance by name", () => {
    const guidance = getToolGuidance("github_search");
    expect(guidance).toBeDefined();
    expect(guidance?.name).toBe("github_search");
    expect(guidance?.priority).toBe(10);
  });

  it("returns undefined for unknown tools", () => {
    expect(getToolGuidance("unknown_tool")).toBeUndefined();
  });

  it("returns tools sorted by priority", () => {
    const tools = getToolsByPriority();
    expect(tools.length).toBeGreaterThan(0);
    // First tool should have highest priority
    expect(tools[0].priority).toBeGreaterThanOrEqual(tools[tools.length - 1].priority);
  });
});

describe("buildPlannerSystemPrompt", () => {
  it("builds default mode prompt", () => {
    const config = createMockConfig();
    const prompt = buildPlannerSystemPrompt(config);

    expect(prompt).toContain("<role>");
    expect(prompt).toContain("Bandry");
    expect(prompt).toContain("<clarification_system>");
    expect(prompt).toContain("<tool_selection>");
    expect(prompt).toContain("github_search");
    expect(prompt).toContain("web_search");
    expect(prompt).toContain("/mnt/workspace");
  });

  it("builds thinking mode prompt with extended guidance", () => {
    const config = createMockConfig();
    const prompt = buildPlannerSystemPrompt(config, { mode: "thinking" });

    expect(prompt).toContain("<thinking_style>");
    expect(prompt).toContain("Consider multiple approaches");
    expect(prompt).toContain("Validate assumptions");
  });

  it("builds subagents mode prompt with orchestration guidance", () => {
    const config = createMockConfig();
    const prompt = buildPlannerSystemPrompt(config, { mode: "subagents" });

    expect(prompt).toContain("<subagent_system>");
    expect(prompt).toContain("DECOMPOSE, DELEGATE, SYNTHESIZE");
    expect(prompt).toContain("MAXIMUM 3");
    expect(prompt).toContain("task");
  });

  it("injects persist requirement when requested", () => {
    const config = createMockConfig();
    const prompt = buildPlannerSystemPrompt(config, {
      userMessage: "生成 md 并保存",
      persistRequired: true,
      persistPathHint: "/mnt/workspace/output/report.md"
    });

    expect(prompt).toContain("<persist_requirement>");
    expect(prompt).toContain("MUST call write_file");
    expect(prompt).toContain("/mnt/workspace/output/report.md");
  });

  it("detects user language and includes hint", () => {
    const config = createMockConfig();
    const promptZh = buildPlannerSystemPrompt(config, {
      userMessage: "搜索 GitHub 上的项目"
    });
    expect(promptZh).toContain("Chinese");

    const promptEn = buildPlannerSystemPrompt(config, {
      userMessage: "Search for projects on GitHub"
    });
    expect(promptEn).toContain("English");
  });

  it("includes enabled tools based on config", () => {
    const configWithTools = createMockConfig();
    const prompt = buildPlannerSystemPrompt(configWithTools);
    expect(prompt).toContain("github_search");
    expect(prompt).toContain("web_search");
    expect(prompt).toContain("web_fetch");

    const configWithoutTools = createMockConfig({
      tools: {
        webSearch: { ...createMockConfig().tools.webSearch, enabled: false },
        webFetch: { ...createMockConfig().tools.webFetch, enabled: false },
        githubSearch: { ...createMockConfig().tools.githubSearch, enabled: false }
      }
    });
    const promptNoTools = buildPlannerSystemPrompt(configWithoutTools);
    // Check that the enabled tools list doesn't include the disabled tools
    // The tool selection guidance section still mentions them as examples
    expect(promptNoTools).toContain("Available tools: list_dir, read_file, write_file, exec, ask_clarification, delegate_sub_tasks");
    expect(promptNoTools).not.toContain("Available tools: list_dir, read_file, write_file, exec, ask_clarification, delegate_sub_tasks, github_search");
  });
});

describe("buildFinalSystemPrompt", () => {
  it("builds synthesizer prompt", () => {
    const prompt = buildFinalSystemPrompt();

    expect(prompt).toContain("Bandry");
    expect(prompt).toContain("concise");
    expect(prompt).toContain("observations");
  });
});
