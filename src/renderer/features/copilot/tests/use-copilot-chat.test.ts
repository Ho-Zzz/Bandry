import { describe, expect, it } from "vitest";
import type { ChatUpdateEvent } from "../../../../shared/ipc";
import {
  isConversationLoading,
  normalizeClarificationInput,
  resolveRequestSettingsFromTrace,
  resolvePendingClarificationFromUpdate
} from "../use-copilot-chat";

describe("use-copilot-chat helpers", () => {
  it("isolates loading state by conversation id", () => {
    expect(isConversationLoading({ conv_a: "req_1" }, "conv_a")).toBe(true);
    expect(isConversationLoading({ conv_a: "req_1" }, "conv_b")).toBe(false);
    expect(isConversationLoading({ conv_a: "req_1" }, undefined)).toBe(false);
  });

  it("extracts clarification payload for current conversation only", () => {
    const update: ChatUpdateEvent = {
      requestId: "req_1",
      stage: "clarification",
      message: "请选择语言",
      timestamp: Date.now(),
      payload: {
        clarification: {
          question: "请选择语言",
          options: [
            { label: "中文", value: "请用中文", recommended: true },
            { label: "英文", value: "Please use English" },
            { label: "双语", value: "请双语输出" }
          ]
        }
      }
    };

    const accepted = resolvePendingClarificationFromUpdate(update, "conv_a", "conv_a");
    expect(accepted?.question).toBe("请选择语言");
    expect(accepted?.options).toHaveLength(3);
    expect(accepted?.options[0]?.recommended).toBe(true);

    const ignored = resolvePendingClarificationFromUpdate(update, "conv_a", "conv_b");
    expect(ignored).toBeNull();
  });

  it("normalizes clarification input before submission", () => {
    expect(normalizeClarificationInput("  继续执行  ")).toBe("继续执行");
    expect(normalizeClarificationInput("   ")).toBe("");
  });

  it("extracts request mode and thinking state from planning trace", () => {
    const trace: ChatUpdateEvent[] = [
      {
        requestId: "req_2",
        stage: "planning",
        message: "Mode: default",
        timestamp: 1
      },
      {
        requestId: "req_2",
        stage: "planning",
        message: "Thinking enabled: false",
        timestamp: 2
      }
    ];

    expect(resolveRequestSettingsFromTrace(trace)).toEqual({
      mode: "default",
      thinkingEnabled: false
    });
  });
});
