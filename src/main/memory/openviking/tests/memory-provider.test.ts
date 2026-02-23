import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenVikingMemoryProvider } from "../memory-provider";

const createConversation = () => ({
  sessionId: "session_1",
  messages: [
    { role: "system" as const, content: "ignore me", timestamp: Date.now() - 2000 },
    { role: "user" as const, content: "What did we decide?", timestamp: Date.now() - 1000 },
    { role: "assistant" as const, content: "We chose OpenViking.", timestamp: Date.now() }
  ]
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("OpenVikingMemoryProvider", () => {
  it("injects context from search results", async () => {
    const mockClient = {
      createSession: vi.fn(async () => ({ sessionId: "ov_session_1" })),
      search: vi.fn(async () => ({
        memories: [
          {
            uri: "viking://user/memories/mem_1.md",
            abstract: "User prefers TypeScript",
            score: 0.91,
            category: "preferences"
          }
        ],
        resources: [],
        skills: []
      }))
    } as any;

    const provider = new OpenVikingMemoryProvider(mockClient, {
      targetUris: ["viking://user/memories"],
      topK: 5,
      scoreThreshold: 0.3,
      commitDebounceMs: 1000
    });

    const chunks = await provider.injectContext("session_1", "what are my preferences?");

    expect(mockClient.createSession).toHaveBeenCalledOnce();
    expect(mockClient.search).toHaveBeenCalledOnce();
    expect(chunks).toHaveLength(1);
    expect(chunks[0].source).toBe("viking://user/memories/mem_1.md");
    expect(chunks[0].layer).toBe("L1");
    expect(chunks[0].content).toContain("User prefers TypeScript");
  });

  it("debounces conversation persistence and avoids duplicate commits", async () => {
    vi.useFakeTimers();

    const mockClient = {
      createSession: vi.fn(async () => ({ sessionId: "ov_session_1" })),
      addSessionMessage: vi.fn(async () => undefined),
      commitSession: vi.fn(async () => undefined)
    } as any;

    const provider = new OpenVikingMemoryProvider(mockClient, {
      targetUris: ["viking://user/memories"],
      topK: 5,
      scoreThreshold: 0.3,
      commitDebounceMs: 1000
    });

    const conversation = createConversation();
    await provider.storeConversation(conversation);
    await provider.storeConversation(conversation);

    expect(mockClient.addSessionMessage).not.toHaveBeenCalled();
    expect(mockClient.commitSession).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    await vi.runOnlyPendingTimersAsync();

    expect(mockClient.addSessionMessage).toHaveBeenCalledTimes(2);
    expect(mockClient.commitSession).toHaveBeenCalledTimes(1);

    await provider.storeConversation(conversation);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.runOnlyPendingTimersAsync();

    expect(mockClient.commitSession).toHaveBeenCalledTimes(1);
  });
});
