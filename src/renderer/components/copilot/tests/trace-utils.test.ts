import { describe, expect, it } from "vitest";

import {
  buildProcessSections,
  buildProcessLineItems,
  buildSourcesFromParts,
  buildToolSummaries,
  extractTraceItems,
  formatDuration,
  hasSearchLikeToolActivity,
  tryFormatJson
} from "../thread/process/trace-utils";

describe("trace-utils", () => {
  it("extracts trace items from tool-call parts and propagates workspacePath", () => {
    const parts = [
      {
        type: "tool-call",
        toolName: "trace_tool",
        args: { stage: "tool" },
        result: {
          message: "exec -> success: wrote /output/report.md",
          timestamp: 1000,
          workspacePath: "/tmp/ws"
        }
      },
      {
        type: "tool-call",
        toolName: "trace_final",
        args: { stage: "final" },
        result: {
          message: "done",
          timestamp: 1100
        }
      }
    ];

    const items = extractTraceItems(parts);
    expect(items).toHaveLength(2);
    expect(items[0]?.source).toBe("exec");
    expect(items[0]?.workspacePath).toBe("/tmp/ws");
    expect(items[1]?.workspacePath).toBe("/tmp/ws");
  });

  it("keeps only latest summary per tool source", () => {
    const summaries = buildToolSummaries([
      {
        id: "1",
        kind: "Result",
        stage: "tool",
        message: "exec -> success: v1",
        timestamp: 1000,
        source: "exec",
        status: "success"
      },
      {
        id: "2",
        kind: "Result",
        stage: "tool",
        message: "exec -> failed: v2",
        timestamp: 1200,
        source: "exec",
        status: "failed"
      }
    ], false);

    expect(summaries).toHaveLength(2);
    expect(summaries[1]?.status).toBe("failed");
    expect(summaries[1]?.output).toBe("v2");
    expect(summaries[1]?.sources).toEqual([]);
  });

  it("extracts web sources for search-like tool summaries", () => {
    const summaries = buildToolSummaries([
      {
        id: "s1",
        kind: "Result",
        stage: "tool",
        message: "web_search -> success: found https://example.com/a and https://example.com/b",
        timestamp: 100
      }
    ], false);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.sources.map((item) => item.url)).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("adds loading summary while tool is running without result", () => {
    const summaries = buildToolSummaries([
      {
        id: "p1",
        kind: "Tool",
        stage: "tool",
        message: "执行工具：web_search",
        source: "web_search",
        timestamp: 100
      }
    ], true);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.status).toBe("loading");
    expect(summaries[0]?.source).toBe("web_search");
  });

  it("groups process sections by type in order", () => {
    const sections = buildProcessSections([
      {
        id: "plan-1",
        kind: "Plan",
        stage: "planning",
        message: "plan"
      },
      {
        id: "tool-1",
        kind: "Tool",
        stage: "tool",
        message: "run"
      },
      {
        id: "tool-2",
        kind: "Result",
        stage: "tool",
        message: "exec -> success: done"
      },
      {
        id: "final-1",
        kind: "Result",
        stage: "final",
        message: "final"
      }
    ]);

    expect(sections.map((section) => section.type)).toEqual(["planning", "execution", "finalizing"]);
    expect(sections[1]?.items).toHaveLength(2);
  });

  it("formats utility output safely", () => {
    expect(formatDuration(400)).toBe("400 ms");
    expect(formatDuration(1400)).toBe("1.4 s");
    expect(tryFormatJson('{"a":1}')).toContain('"a": 1');
    expect(tryFormatJson("plain text")).toBeNull();
  });

  it("extracts deduped sources from text and tool traces", () => {
    const sources = buildSourcesFromParts([
      {
        type: "text",
        text: "Ref: https://example.com/a and [doc](https://example.com/b)"
      },
      {
        type: "tool-call",
        toolName: "trace_tool",
        args: { stage: "tool" },
        result: {
          message: "search -> success: https://example.com/a https://news.ycombinator.com/",
          timestamp: 1
        }
      }
    ]);

    expect(sources.map((item) => item.url)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
      "https://news.ycombinator.com/"
    ]);
  });

  it("detects search-like tool activity for source rendering", () => {
    expect(
      hasSearchLikeToolActivity([
        {
          type: "tool-call",
          toolName: "web_search",
          args: { stage: "tool" },
          result: { message: "web_search -> success: https://example.com", timestamp: 1 }
        }
      ])
    ).toBe(true);

    expect(
      hasSearchLikeToolActivity([
        {
          type: "tool-call",
          toolName: "write_file",
          args: { stage: "tool" },
          result: { message: "write_file -> success: /output/a.md", timestamp: 1 }
        }
      ])
    ).toBe(false);
  });

  it("builds line-based process items for planning and tool execution", () => {
    const lines = buildProcessLineItems(
      [
        {
          id: "p1",
          kind: "Plan",
          stage: "planning",
          message: "回忆相关上下文"
        },
        {
          id: "t1",
          kind: "Tool",
          stage: "tool",
          message: "执行工具：web_search（查找最新信息）",
          source: "web_search"
        },
        {
          id: "r1",
          kind: "Result",
          stage: "tool",
          message: "web_search -> success: found https://example.com/a"
        }
      ],
      true
    );

    expect(lines.map((line) => line.title)).toEqual(["回忆完成", "搜索完成"]);
    expect(lines[0]?.status).toBe("success");
    expect(lines[1]?.status).toBe("success");
  });

  it("turns remaining running lines into completed when request stops", () => {
    const lines = buildProcessLineItems(
      [
        {
          id: "t1",
          kind: "Tool",
          stage: "tool",
          message: "执行工具：read_file",
          source: "read_file"
        }
      ],
      false
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]?.status).toBe("success");
    expect(lines[0]?.title).toContain("完成");
  });

  it("hides answer preparation and completion lines", () => {
    const lines = buildProcessLineItems(
      [
        {
          id: "1",
          kind: "Plan",
          stage: "planning",
          message: "准备回答"
        },
        {
          id: "2",
          kind: "Plan",
          stage: "model",
          message: "整理工具结果并准备回答"
        },
        {
          id: "3",
          kind: "Result",
          stage: "final",
          message: "最终回答已生成"
        },
        {
          id: "4",
          kind: "Result",
          stage: "final",
          message: "最终回答已生成"
        }
      ],
      false
    );

    expect(lines.filter((line) => line.title === "准备回答")).toHaveLength(0);
    expect(lines.filter((line) => line.title === "回答完成")).toHaveLength(0);
  });

  it("uses thinking-oriented running copy in thinking mode", () => {
    const lines = buildProcessLineItems(
      [
        {
          id: "t1",
          kind: "Tool",
          stage: "tool",
          message: "执行工具：web_search",
          source: "web_search"
        }
      ],
      true,
      {
        mode: "thinking",
        thinkingEnabled: true
      }
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]?.title).toBe("思考检索中");
    expect(lines[0]?.status).toBe("running");
  });
});
