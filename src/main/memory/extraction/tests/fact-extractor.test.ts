import { describe, expect, it, vi } from "vitest";
import { FactExtractor } from "../fact-extractor";
import type { Conversation } from "../../contracts/types";
import type { ModelsFactory } from "../../../llm/runtime";
import type { AppConfig } from "../../../config";

const createMockConfig = (): AppConfig => ({
  llm: {
    defaultProvider: "openai",
    defaultModel: "gpt-4",
    timeoutMs: 60000,
    maxRetries: 3,
    retryBaseMs: 500,
    rateLimitRps: 2,
    networkMode: "auto",
    offlineNonModelOnly: true,
    auditLogEnabled: false,
    piiRedactionEnabled: false
  },
  sandbox: {
    virtualRoot: "/mnt/workspace",
    allowedWorkspaces: [],
    allowedCommands: [],
    execTimeoutMs: 30000,
    maxOutputBytes: 64 * 1024,
    auditLogEnabled: false
  },
  subagent: {
    maxConcurrent: 3,
    timeoutMs: 900_000
  },
  providers: {
    openai: {
      enabled: true,
      apiKey: "sk-openai-valid-key-1234567890",
      baseUrl: "",
      model: "gpt-4",
      embeddingModel: "text-embedding-3-large"
    },
    deepseek: {
      enabled: false,
      apiKey: "",
      baseUrl: "",
      model: "",
      embeddingModel: ""
    },
    volcengine: {
      enabled: false,
      apiKey: "",
      baseUrl: "",
      model: "",
      embeddingModel: "doubao-embedding-vision-250615"
    },
    openrouter: {
      enabled: false,
      apiKey: "",
      baseUrl: "",
      model: "",
      embeddingModel: ""
    },
    groq: {
      enabled: false,
      apiKey: "",
      baseUrl: "",
      model: "",
      embeddingModel: ""
    },
    moonshot: {
      enabled: false,
      apiKey: "",
      baseUrl: "",
      model: "",
      embeddingModel: ""
    },
    qwen: {
      enabled: false,
      apiKey: "",
      baseUrl: "",
      model: "",
      embeddingModel: ""
    },
    siliconflow: {
      enabled: false,
      apiKey: "",
      baseUrl: "",
      model: "",
      embeddingModel: ""
    },
    together: {
      enabled: false,
      apiKey: "",
      baseUrl: "",
      model: "",
      embeddingModel: ""
    }
  },
  features: {
    enableMemory: false,
    enableMCP: false
  },
  openviking: {
    enabled: true,
    host: "127.0.0.1",
    port: 1933,
    apiKey: "",
    vlmProfileId: "profile_openai_default",
    embeddingProfileId: "profile_openai_default",
    serverCommand: "openviking",
    serverArgs: ["serve"],
    startTimeoutMs: 20_000,
    healthcheckIntervalMs: 500,
    memoryTopK: 6,
    memoryScoreThreshold: 0.35,
    commitDebounceMs: 30_000,
    targetUris: ["viking://user/memories", "viking://agent/memories"]
  },
  catalog: {
    source: {
      type: "http",
      location: "https://models.dev/api.json",
      schema: "models.dev",
      timeoutMs: 12000
    }
  },
  modelProfiles: [
    {
      id: "profile_openai_default",
      name: "OpenAI Default",
      provider: "openai",
      model: "gpt-4",
      enabled: true,
      temperature: 0.2
    }
  ],
  routing: {
    assignments: {
      "chat.default": "profile_openai_default",
      "lead.planner": "profile_openai_default",
      "lead.synthesizer": "profile_openai_default",
      "sub.researcher": "profile_openai_default",
      "sub.bash_operator": "profile_openai_default",
      "sub.writer": "profile_openai_default",
      "memory.fact_extractor": "profile_openai_default"
    }
  },
  tools: {
    webSearch: {
      enabled: false,
      provider: "tavily",
      apiKey: "",
      baseUrl: "https://api.tavily.com",
      timeoutMs: 15000,
      maxResults: 5
    },
    webFetch: {
      enabled: false,
      provider: "jina",
      apiKey: "",
      baseUrl: "https://r.jina.ai/http://",
      timeoutMs: 15000
    },
    githubSearch: {
      enabled: true,
      apiKey: "",
      baseUrl: "https://api.github.com",
      timeoutMs: 15000,
      maxResults: 10
    }
  },
  channels: {
    enabled: false,
    channels: []
  },
  paths: {
    projectRoot: "",
    bandryHome: "",
    configDir: "",
    logsDir: "",
    workspacesDir: "",
    pluginsDir: "",
    projectConfigPath: "",
    userConfigPath: "",
    auditLogPath: "",
    sandboxAuditLogPath: "",
    workspaceDir: "",
    databasePath: "",
    traceDir: "",
    resourcesDir: "",
    dotenvPath: ""
  },
  runtime: {
    inheritedEnv: {}
  }
});

describe("FactExtractor", () => {
  it("should extract facts from conversation", async () => {
    const mockModelsFactory = {
      generateText: vi.fn(async () => ({
        provider: "openai" as const,
        model: "gpt-4",
        text: JSON.stringify([
          {
            content: "User prefers TypeScript over JavaScript",
            tags: ["preference", "language"],
            confidence: 0.9
          },
          {
            content: "Project uses Vite for bundling",
            tags: ["tooling", "build"],
            confidence: 1.0
          }
        ]),
        latencyMs: 100
      }))
    } as unknown as ModelsFactory;

    const config = createMockConfig();
    const extractor = new FactExtractor(mockModelsFactory, config);

    const conversation: Conversation = {
      sessionId: "session_123",
      messages: [
        {
          role: "user",
          content: "I prefer TypeScript over JavaScript",
          timestamp: Date.now()
        },
        {
          role: "assistant",
          content: "Great choice! TypeScript provides type safety.",
          timestamp: Date.now()
        },
        {
          role: "user",
          content: "We're using Vite for bundling",
          timestamp: Date.now()
        }
      ]
    };

    const facts = await extractor.extractFacts(conversation);

    expect(facts).toHaveLength(2);
    expect(facts[0].content).toBe("User prefers TypeScript over JavaScript");
    expect(facts[0].tags).toEqual(["preference", "language"]);
    expect(facts[0].confidence).toBe(0.9);
    expect(facts[0].source).toBe("session_123");
    expect(facts[1].content).toBe("Project uses Vite for bundling");
  });

  it("should filter facts by minimum confidence", async () => {
    const mockModelsFactory = {
      generateText: vi.fn(async () => ({
        provider: "openai" as const,
        model: "gpt-4",
        text: JSON.stringify([
          {
            content: "High confidence fact",
            tags: ["test"],
            confidence: 0.9
          },
          {
            content: "Low confidence fact",
            tags: ["test"],
            confidence: 0.3
          }
        ]),
        latencyMs: 100
      }))
    } as unknown as ModelsFactory;

    const config = createMockConfig();
    const extractor = new FactExtractor(mockModelsFactory, config);

    const conversation: Conversation = {
      sessionId: "session_123",
      messages: [
        {
          role: "user",
          content: "Test message",
          timestamp: Date.now()
        }
      ]
    };

    const facts = await extractor.extractFacts(conversation, {
      minConfidence: 0.5
    });

    expect(facts).toHaveLength(1);
    expect(facts[0].content).toBe("High confidence fact");
  });

  it("should handle empty conversation", async () => {
    const mockModelsFactory = {
      generateText: vi.fn()
    } as unknown as ModelsFactory;

    const config = createMockConfig();
    const extractor = new FactExtractor(mockModelsFactory, config);

    const conversation: Conversation = {
      sessionId: "session_123",
      messages: []
    };

    const facts = await extractor.extractFacts(conversation);

    expect(facts).toHaveLength(0);
    expect(mockModelsFactory.generateText).not.toHaveBeenCalled();
  });

  it("should handle invalid JSON response", async () => {
    const mockModelsFactory = {
      generateText: vi.fn(async () => ({
        provider: "openai" as const,
        model: "gpt-4",
        text: "This is not valid JSON",
        latencyMs: 100
      }))
    } as unknown as ModelsFactory;

    const config = createMockConfig();
    const extractor = new FactExtractor(mockModelsFactory, config);

    const conversation: Conversation = {
      sessionId: "session_123",
      messages: [
        {
          role: "user",
          content: "Test message",
          timestamp: Date.now()
        }
      ]
    };

    const facts = await extractor.extractFacts(conversation);

    expect(facts).toHaveLength(0);
  });

  it("should extract facts from plain text", async () => {
    const mockModelsFactory = {
      generateText: vi.fn(async () => ({
        provider: "openai" as const,
        model: "gpt-4",
        text: JSON.stringify([
          {
            content: "Extracted fact from text",
            tags: ["test"],
            confidence: 0.8
          }
        ]),
        latencyMs: 100
      }))
    } as unknown as ModelsFactory;

    const config = createMockConfig();
    const extractor = new FactExtractor(mockModelsFactory, config);

    const facts = await extractor.extractFromText(
      "This is some text to extract facts from",
      "text_source"
    );

    expect(facts).toHaveLength(1);
    expect(facts[0].content).toBe("Extracted fact from text");
    expect(facts[0].source).toBe("text_source");
  });

  it("should merge duplicate facts", () => {
    const config = createMockConfig();
    const mockModelsFactory = {} as ModelsFactory;
    const extractor = new FactExtractor(mockModelsFactory, config);

    const facts = [
      {
        id: "1",
        content: "User prefers TypeScript",
        source: "session_1",
        timestamp: Date.now(),
        tags: ["preference"],
        confidence: 0.9
      },
      {
        id: "2",
        content: "User prefers TypeScript",
        source: "session_2",
        timestamp: Date.now(),
        tags: ["preference"],
        confidence: 0.8
      },
      {
        id: "3",
        content: "Project uses Vite",
        source: "session_1",
        timestamp: Date.now(),
        tags: ["tooling"],
        confidence: 1.0
      }
    ];

    const merged = extractor.mergeFacts(facts);

    expect(merged).toHaveLength(2);
    expect(merged[0].content).toBe("User prefers TypeScript");
    expect(merged[1].content).toBe("Project uses Vite");
  });

  it("should filter facts by tags", () => {
    const config = createMockConfig();
    const mockModelsFactory = {} as ModelsFactory;
    const extractor = new FactExtractor(mockModelsFactory, config);

    const facts = [
      {
        id: "1",
        content: "Fact 1",
        source: "session_1",
        timestamp: Date.now(),
        tags: ["preference", "language"],
        confidence: 0.9
      },
      {
        id: "2",
        content: "Fact 2",
        source: "session_1",
        timestamp: Date.now(),
        tags: ["tooling", "build"],
        confidence: 0.8
      },
      {
        id: "3",
        content: "Fact 3",
        source: "session_1",
        timestamp: Date.now(),
        tags: ["preference"],
        confidence: 1.0
      }
    ];

    const filtered = extractor.filterByTags(facts, ["preference"]);

    expect(filtered).toHaveLength(2);
    expect(filtered[0].tags).toContain("preference");
    expect(filtered[1].tags).toContain("preference");
  });

  it("should sort facts by confidence", () => {
    const config = createMockConfig();
    const mockModelsFactory = {} as ModelsFactory;
    const extractor = new FactExtractor(mockModelsFactory, config);

    const facts = [
      {
        id: "1",
        content: "Low confidence",
        source: "session_1",
        timestamp: Date.now(),
        confidence: 0.5
      },
      {
        id: "2",
        content: "High confidence",
        source: "session_1",
        timestamp: Date.now(),
        confidence: 0.95
      },
      {
        id: "3",
        content: "Medium confidence",
        source: "session_1",
        timestamp: Date.now(),
        confidence: 0.7
      }
    ];

    const sorted = extractor.sortByConfidence(facts);

    expect(sorted[0].confidence).toBe(0.95);
    expect(sorted[1].confidence).toBe(0.7);
    expect(sorted[2].confidence).toBe(0.5);
  });

  it("should get top N facts", () => {
    const config = createMockConfig();
    const mockModelsFactory = {} as ModelsFactory;
    const extractor = new FactExtractor(mockModelsFactory, config);

    const facts = [
      {
        id: "1",
        content: "Fact 1",
        source: "session_1",
        timestamp: Date.now(),
        confidence: 0.5
      },
      {
        id: "2",
        content: "Fact 2",
        source: "session_1",
        timestamp: Date.now(),
        confidence: 0.95
      },
      {
        id: "3",
        content: "Fact 3",
        source: "session_1",
        timestamp: Date.now(),
        confidence: 0.7
      }
    ];

    const top2 = extractor.getTopFacts(facts, 2);

    expect(top2).toHaveLength(2);
    expect(top2[0].confidence).toBe(0.95);
    expect(top2[1].confidence).toBe(0.7);
  });
});
