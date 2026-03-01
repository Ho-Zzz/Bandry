import { describe, expect, it } from "vitest";
import {
  defaultPersistPath,
  detectPersistRequirement,
  extractRequestedPath,
  resolvePersistWritePath
} from "../persist-policy";

describe("persist-policy", () => {
  it("detects explicit persist requirement", () => {
    const result = detectPersistRequirement("请生成一个 md 简报并保存");
    expect(result.required).toBe(true);
    expect(result.markdownPreferred).toBe(true);
  });

  it("does not trigger for ordinary chat", () => {
    const result = detectPersistRequirement("你好，解释一下什么是多因子模型");
    expect(result.required).toBe(false);
  });

  it("does not trigger for read-only file requests", () => {
    const result = detectPersistRequirement("请读取 output/report.md 并帮我总结要点");
    expect(result.required).toBe(false);
  });

  it("extracts requested path from user message", () => {
    const result = extractRequestedPath("请保存到 output/market-report.md");
    expect(result).toBe("output/market-report.md");
  });

  it("builds default persist path", () => {
    const value = defaultPersistPath("生成简报", new Date("2026-02-27T08:00:00"));
    expect(value).toBe("output/brief-20260227-080000.md");
  });

  it("allows path under output", () => {
    const result = resolvePersistWritePath({
      requestedPath: "output/report.md",
      defaultPath: "output/default.md",
      virtualRoot: "/mnt/workspace"
    });
    expect(result).toEqual({
      ok: true,
      path: "/mnt/workspace/output/report.md",
      explicit: true
    });
  });

  it("allows absolute path under output", () => {
    const result = resolvePersistWritePath({
      requestedPath: "/mnt/workspace/output/report.md",
      defaultPath: "output/default.md",
      virtualRoot: "/mnt/workspace"
    });
    expect(result).toEqual({
      ok: true,
      path: "/mnt/workspace/output/report.md",
      explicit: true
    });
  });

  it("rejects path outside output", () => {
    const result = resolvePersistWritePath({
      requestedPath: "/mnt/workspace/README.md",
      defaultPath: "output/default.md",
      virtualRoot: "/mnt/workspace"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PATH_NOT_ALLOWED");
    }
  });

  it("rejects path traversal", () => {
    const result = resolvePersistWritePath({
      requestedPath: "output/../../secret.md",
      defaultPath: "output/default.md",
      virtualRoot: "/mnt/workspace"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PATH_NOT_ALLOWED");
    }
  });
});
