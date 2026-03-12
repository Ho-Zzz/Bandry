import { describe, it, expect } from "vitest";
import { parseChannelCommand } from "../parse-command";

describe("parseChannelCommand", () => {
  it("returns default mode for plain messages", () => {
    const result = parseChannelCommand("你好世界");
    expect(result).toEqual({ mode: "default", text: "你好世界" });
  });

  it("parses /think into thinking mode", () => {
    const result = parseChannelCommand("/think 你好");
    expect(result).toEqual({ mode: "thinking", text: "你好" });
  });

  it("parses /agents into subagents mode", () => {
    const result = parseChannelCommand("/agents 帮我分析");
    expect(result).toEqual({ mode: "subagents", text: "帮我分析" });
  });

  it("parses /subagents into subagents mode", () => {
    const result = parseChannelCommand("/subagents 帮我分析");
    expect(result).toEqual({ mode: "subagents", text: "帮我分析" });
  });

  it("parses /model:<profileId> and sets modelProfileId", () => {
    const result = parseChannelCommand("/model:deepseek-v3 hello");
    expect(result).toEqual({ mode: "default", modelProfileId: "deepseek-v3", text: "hello" });
  });

  it("handles combined /think /model:<id>", () => {
    const result = parseChannelCommand("/think /model:gpt4 hello");
    expect(result).toEqual({ mode: "thinking", modelProfileId: "gpt4", text: "hello" });
  });

  it("handles combined /model:<id> /think (reversed order)", () => {
    const result = parseChannelCommand("/model:gpt4 /think hello");
    expect(result).toEqual({ mode: "thinking", modelProfileId: "gpt4", text: "hello" });
  });

  it("returns thinking mode with empty text for bare /think", () => {
    const result = parseChannelCommand("/think");
    expect(result).toEqual({ mode: "thinking", text: "" });
  });

  it("treats unknown slash commands as plain text", () => {
    const result = parseChannelCommand("/random text");
    expect(result).toEqual({ mode: "default", text: "/random text" });
  });

  it("trims leading/trailing whitespace from input", () => {
    const result = parseChannelCommand("  /think  你好  ");
    expect(result.mode).toBe("thinking");
    expect(result.text).toBe("你好");
  });

  it("handles empty string input", () => {
    const result = parseChannelCommand("");
    expect(result).toEqual({ mode: "default", text: "" });
  });

  it("handles whitespace-only input", () => {
    const result = parseChannelCommand("   ");
    expect(result).toEqual({ mode: "default", text: "" });
  });
});
