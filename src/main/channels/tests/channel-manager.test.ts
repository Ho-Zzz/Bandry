import { describe, expect, it, vi } from "vitest";
import type { Channel, NormalizedInboundMessage } from "../types";
import { ChannelManager } from "../channel-manager";
import type { ChatSendResult } from "../../../shared/ipc";

const makeInbound = (text: string, platformMessageId: string): NormalizedInboundMessage => {
  return {
    platformMessageId,
    channelId: "test-channel",
    platformChatId: "chat-1",
    sender: "user-1",
    text,
    messageType: "text",
    timestamp: Date.now()
  };
};

describe("ChannelManager", () => {
  it("creates a fresh request-scoped agent for each inbound message", async () => {
    const sendResult: ChatSendResult = {
      reply: "ok",
      provider: "openai",
      model: "gpt-4.1-mini",
      latencyMs: 1
    };
    const sends: Array<ReturnType<typeof vi.fn>> = [];
    const createAgent = vi.fn().mockImplementation(() => {
      const send = vi.fn(async () => sendResult);
      sends.push(send);
      return {
        agent: { send },
        context: {
          thinkingEnabled: false,
          apiExtras: {},
          warnings: []
        }
      };
    });

    const messagesByConversation = new Map<string, Array<{ role: "user" | "assistant" | "system"; content: string }>>();
    const conversationStore = {
      createConversation: vi.fn(() => ({
        id: "conv-1"
      })),
      createMessage: vi.fn((input: { conversation_id: string; role: "user" | "assistant" | "system"; content: string }) => {
        const existing = messagesByConversation.get(input.conversation_id) ?? [];
        existing.push({ role: input.role, content: input.content });
        messagesByConversation.set(input.conversation_id, existing);
      }),
      listMessages: vi.fn((conversationId: string) => {
        const existing = messagesByConversation.get(conversationId) ?? [];
        return existing.map((item, index) => ({
          id: `msg-${index + 1}`,
          role: item.role,
          content: item.content,
          status: "completed",
          created_at: Date.now()
        }));
      })
    };

    const eventBus = {
      broadcastTaskUpdate: vi.fn(),
      broadcastChatUpdate: vi.fn(),
      broadcastChatDelta: vi.fn(),
      broadcastChannelStatus: vi.fn()
    };

    const manager = new ChannelManager(
      {
        createAgent
      } as never,
      conversationStore as never,
      eventBus,
      { enabled: true }
    );

    const channel: Channel = {
      id: "test-channel",
      start: async () => {},
      stop: async () => {},
      getStatus: () => "running",
      sendReply: vi.fn(async () => {}),
      onMessage: () => {}
    };
    manager.register(channel);

    const invokeInbound = async (text: string, messageId: string) => {
      await (
        manager as unknown as {
          handleInbound: (inboundChannel: Channel, msg: NormalizedInboundMessage) => Promise<void>;
        }
      ).handleInbound(channel, makeInbound(text, messageId));
    };

    await invokeInbound("hello", "m1");
    await invokeInbound("/think second", "m2");

    expect(createAgent).toHaveBeenCalledTimes(2);
    expect(conversationStore.createConversation).toHaveBeenCalledTimes(1);
    expect(sends).toHaveLength(2);
    expect(sends[0]).not.toBe(sends[1]);
    expect(sends[0]).toHaveBeenCalledTimes(1);
    expect(sends[1]).toHaveBeenCalledTimes(1);
    expect(createAgent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        conversationId: "conv-1",
        mode: "default",
        thinkingEnabled: undefined
      })
    );
    expect(createAgent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        conversationId: "conv-1",
        mode: "thinking",
        thinkingEnabled: true
      })
    );
  });
});
