# Implementation Plan: Global Resource Center & Coding Agent Adapter

> Date: 2026-02-24
> Status: Draft
> Depends on: Workspace Middleware (已实现), DAG Sub-Agent Framework (已实现)

## 目标概述

分两阶段实现：

1. **Phase 1 — 全局资源中心**：任务完成后，agent 自动判断产出物价值并转存到全局资源中心
2. **Phase 2 — Coding Agent 适配层**：通用适配层对接外部 coding agent（claude code / opencode），以 sub-agent 角色纳入编排体系

---

## Phase 1: Global Resource Center

### 1.1 设计思路

```
任务工作区 (临时)                    全局资源中心 (持久)
~/.bandry/workspaces/task_xxx/      ~/.bandry/resources/
  output/report.md          ──→       artifacts/report-{hash}.md
  output/analysis.json      ──→       artifacts/analysis-{hash}.json
                                      manifest.jsonl  ← 资源索引
```

核心流程：
1. 任务结束时（afterAgent 阶段），新增 **ResourceCurationMiddleware** 被触发
2. 扫描任务 `output/` 目录，收集产出物列表
3. 调用 LLM 做 **curation judgment**：评估每个产出物的保留价值、分类、摘要
4. 将判断为有价值的产出物复制到 `~/.bandry/resources/artifacts/`
5. 写入 manifest 索引记录（JSONL 追加写入，轻量无需数据库）
6. 新任务启动时，**ResourceInjectionMiddleware** 可从资源中心检索相关上下文

### 1.2 新增文件清单

#### 1.2.1 `src/main/resource-center/types.ts` — 资源类型定义

```typescript
/** 单条资源的元数据 */
export type ResourceEntry = {
  /** 唯一资源 ID (nanoid) */
  id: string;
  /** 原始文件名 */
  originalName: string;
  /** 存储路径（相对 resourcesDir） */
  storagePath: string;
  /** 来源任务 ID */
  sourceTaskId: string;
  /** 来源会话 ID */
  sourceConversationId?: string;
  /** 资源分类 */
  category: ResourceCategory;
  /** AI 生成的摘要 */
  summary: string;
  /** 用户可搜索的标签 */
  tags: string[];
  /** 文件大小 (bytes) */
  sizeBytes: number;
  /** MIME 类型 */
  mimeType: string;
  /** 创建时间 */
  createdAt: string;   // ISO 8601
};

export type ResourceCategory =
  | "document"     // MD, TXT 文档
  | "data"         // JSON, CSV 数据
  | "code"         // 代码文件
  | "config"       // 配置文件
  | "other";

/** LLM curation 判断结果 */
export type CurationJudgment = {
  /** 文件名 */
  fileName: string;
  /** 是否值得保留 */
  shouldKeep: boolean;
  /** 保留理由 */
  reason: string;
  /** 分类 */
  category: ResourceCategory;
  /** 一句话摘要 */
  summary: string;
  /** 标签 */
  tags: string[];
};
```

#### 1.2.2 `src/main/resource-center/resource-store.ts` — 资源存储服务

职责：
- `addResource(entry, sourceFilePath)` — 复制文件到 `artifacts/` + 追加 manifest
- `listResources(filter?)` — 读取 manifest，支持按 category/tags/keyword 过滤
- `getResource(id)` — 获取单条资源元数据
- `readResourceContent(id)` — 读取资源文件内容
- `removeResource(id)` — 删除资源文件 + 从 manifest 移除
- `searchResources(query)` — 基于摘要和标签的简单文本搜索

存储结构：
```
~/.bandry/resources/
├── manifest.jsonl          # 资源索引，每行一条 ResourceEntry JSON
└── artifacts/              # 实际文件存储
    ├── doc-abc123.md
    ├── data-def456.json
    └── ...
```

设计决策：
- **JSONL** 而非 SQLite：资源量不大（百级），JSONL 够用、可读、易调试
- 文件名格式：`{category}-{nanoid}{ext}`，避免冲突
- manifest 读写加文件锁（`proper-lockfile` 或简单 `.lock` 文件）

#### 1.2.3 `src/main/resource-center/curation-judge.ts` — AI 评估器

职责：
- 接收产出物列表（文件名 + 内容摘要）
- 调用 LLM（复用 `lead.synthesizer` 角色）生成 `CurationJudgment[]`
- 评估维度：
  - 是否包含有价值的知识/数据（vs 临时中间产物）
  - 是否可能被未来任务复用
  - 内容质量（非空、非错误输出）

Prompt 设计要点：
- 输入：文件名列表 + 每个文件的前 500 字符预览
- 输出：JSON 数组 `CurationJudgment[]`
- 对于明显的临时文件（空文件、错误日志、debug 输出）直接跳过不送审

#### 1.2.4 `src/main/orchestration/chat/middleware/resource-curation.ts` — 转存中间件

生命周期位置：**afterAgent** 阶段（在 sandbox binding 清理之前）

```typescript
class ResourceCurationMiddleware implements Middleware {
  name = "resource-curation";

  async afterAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    // 1. 扫描 output/ 目录
    // 2. 过滤明显不需要的文件（空文件、.tmp 等）
    // 3. 调用 curation judge
    // 4. 对 shouldKeep=true 的调用 resourceStore.addResource()
    // 5. 在 ctx.metadata 中记录转存结果
  }
}
```

#### 1.2.5 `src/main/orchestration/chat/middleware/resource-injection.ts` — 资源注入中间件

生命周期位置：**beforeAgent** 阶段（在 workspace 和 local-resource 之后）

```typescript
class ResourceInjectionMiddleware implements Middleware {
  name = "resource-injection";

  async beforeAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    // 1. 从用户消息中提取关键词
    // 2. searchResources(keywords) 找相关资源
    // 3. 将摘要信息注入 ctx.metadata.relevantResources
    // 4. 后续 prompt builder 可将此信息加入 system prompt
  }
}
```

### 1.3 中间件注册顺序变更

```typescript
// loader.ts 变更
const middlewares: Middleware[] = [
  new WorkspaceMiddleware(...),
  new LocalResourceMiddleware(),
  new ResourceInjectionMiddleware(resourceStore),    // ← 新增
  new SandboxBindingMiddleware(...),
  new DanglingToolCallMiddleware(),
  new SummarizationMiddleware(),
  new TitleMiddleware(),
  new NoopMemoryMiddleware(),
  new ResourceCurationMiddleware(resourceStore, modelsFactory, config),  // ← 新增
  new SubagentLimitMiddleware(),
  new ClarificationMiddleware()   // 保持最后
];
```

### 1.4 IPC 扩展（可选，Phase 1 可先不做前端）

后续可增加：
- `resource:list` — 列出全局资源
- `resource:read` — 读取资源内容
- `resource:delete` — 删除资源
- `resource:search` — 搜索资源

### 1.5 实现步骤

| Step | 内容 | 预估文件数 |
|------|------|-----------|
| 1 | 定义 `resource-center/types.ts` | 1 |
| 2 | 实现 `resource-center/resource-store.ts` + 单测 | 2 |
| 3 | 实现 `resource-center/curation-judge.ts` + 单测 | 2 |
| 4 | 实现 `ResourceCurationMiddleware` | 1 |
| 5 | 实现 `ResourceInjectionMiddleware` | 1 |
| 6 | 修改 `middleware/loader.ts` 注册新中间件 | 1 (修改) |
| 7 | 集成测试 | 1 |

---

## Phase 2: Coding Agent Adapter

### 2.1 设计思路

```
Bandry Orchestrator
  └── delegate_sub_tasks (DAG)
        └── coding agent (新角色)
              └── CodingAgentAdapter (通用适配层)
                    ├── ClaudeCodeBackend
                    │     └── spawn `claude` CLI process
                    └── OpenCodeBackend
                          └── spawn `opencode` CLI process
```

核心理念：
- Coding Agent 是一个新的 **AgentRole**，和 researcher/writer 平级
- 通过 **Adapter Pattern** 抽象底层工具差异
- 每个 backend 负责：进程生命周期、输入输出协议、结果解析
- Coding Agent 工作在**独立的 workspace 子目录**中，产出物回传到任务 output/

### 2.2 新增文件清单

#### 2.2.1 `src/main/coding-agent/types.ts` — 适配层类型

```typescript
/** Coding agent 执行请求 */
export type CodingRequest = {
  /** 任务描述 */
  prompt: string;
  /** 工作目录（绝对路径） */
  workingDir: string;
  /** 可选的上下文文件路径 */
  contextFiles?: string[];
  /** 超时 (ms) */
  timeoutMs?: number;
  /** 是否允许写操作 */
  allowWrite?: boolean;
};

/** Coding agent 执行结果 */
export type CodingResult = {
  success: boolean;
  /** 输出文本 */
  output: string;
  /** 生成/修改的文件列表 */
  artifacts: string[];
  /** 错误信息 */
  error?: string;
  /** 执行耗时 */
  durationMs: number;
  /** 使用的 backend */
  backend: CodingBackendType;
};

export type CodingBackendType = "claude-code" | "opencode";

/** Backend 适配器接口 */
export interface CodingBackend {
  readonly type: CodingBackendType;
  /** 检测工具是否可用 */
  isAvailable(): Promise<boolean>;
  /** 执行编码任务 */
  execute(request: CodingRequest): Promise<CodingResult>;
  /** 终止当前执行 */
  abort(): void;
}
```

#### 2.2.2 `src/main/coding-agent/backends/claude-code.ts`

通过 `claude` CLI 的 `--print` 模式（非交互）执行：

```typescript
class ClaudeCodeBackend implements CodingBackend {
  type = "claude-code" as const;

  async isAvailable(): Promise<boolean> {
    // which claude / claude --version
  }

  async execute(request: CodingRequest): Promise<CodingResult> {
    // spawn: claude -p "<prompt>" --output-format json
    //   --allowedTools Edit,Write,Bash,Read,Glob,Grep
    //   cwd: request.workingDir
    // parse JSON output
    // collect modified files via git diff or file watcher
  }
}
```

关键点：
- 使用 `--print` / `-p` 模式，单次执行无交互
- 通过 `--allowedTools` 控制权限范围
- 通过 `--output-format json` 获取结构化输出
- 工作目录隔离在任务 workspace 的 `coding/` 子目录

#### 2.2.3 `src/main/coding-agent/backends/opencode.ts`

```typescript
class OpenCodeBackend implements CodingBackend {
  type = "opencode" as const;

  async isAvailable(): Promise<boolean> {
    // which opencode / opencode --version
  }

  async execute(request: CodingRequest): Promise<CodingResult> {
    // spawn opencode process with appropriate flags
    // parse output
    // collect artifacts
  }
}
```

#### 2.2.4 `src/main/coding-agent/coding-agent-adapter.ts` — 统一适配器

```typescript
class CodingAgentAdapter {
  private backends: CodingBackend[];
  private preferredBackend?: CodingBackendType;

  constructor(config: CodingAgentConfig) {
    this.backends = [
      new ClaudeCodeBackend(config.claudeCode),
      new OpenCodeBackend(config.openCode),
    ];
    this.preferredBackend = config.preferredBackend;
  }

  /** 自动选择可用的 backend 执行 */
  async execute(request: CodingRequest): Promise<CodingResult> {
    const backend = await this.resolveBackend();
    return backend.execute(request);
  }

  /** 按优先级检测可用 backend */
  private async resolveBackend(): Promise<CodingBackend> {
    // 1. 优先使用配置的 preferredBackend
    // 2. fallback 到第一个可用的
    // 3. 全部不可用则抛错
  }
}
```

#### 2.2.5 `src/main/orchestration/workflow/dag/agents/sub-agents/coder.ts` — Coder Sub-Agent

```typescript
class CoderAgent extends BaseAgent {
  protected getRole(): AgentRole { return "coder"; }
  protected getDefaultTools(): string[] {
    return ["delegate_to_coding_agent"];
  }

  async execute(input: AgentExecutionInput): Promise<AgentResult> {
    // 1. 准备 coding workspace: {taskWorkspace}/coding/
    // 2. 将依赖的上游产出复制进去
    // 3. 调用 codingAgentAdapter.execute({...})
    // 4. 收集产出物，复制回 output/
    // 5. 返回 AgentResult
  }
}
```

### 2.3 类型扩展

```typescript
// dag/agents/types.ts — AgentRole 新增
export type AgentRole = "lead" | "researcher" | "bash_operator" | "writer"
  | "web_researcher" | "coder";  // ← 新增

// config/types.ts — RuntimeRole 新增
export type RuntimeRole = ... | "sub.coder";

// config/types.ts — 新增 CodingAgentConfig
export type CodingAgentConfig = {
  enabled: boolean;
  preferredBackend?: CodingBackendType;
  claudeCode?: { cliPath?: string; defaultFlags?: string[] };
  openCode?: { cliPath?: string; defaultFlags?: string[] };
  timeoutMs: number;           // 默认 300_000 (5min)
  workspaceIsolation: boolean; // 是否用独立子目录
};
```

### 2.4 安全考量

1. **进程隔离**：coding agent 跑在 child process 中，Bandry 不直接暴露 shell
2. **工作目录限制**：coding agent 只能操作指定的 workspace 子目录
3. **超时控制**：强制超时 kill（默认 5 分钟）
4. **产出审计**：执行前后对比文件系统 diff，记录所有变更
5. **权限委托**：安全责任委托给 claude code / opencode 自身的权限模型
6. **网络隔离**：可选配置，限制 coding agent 的网络访问

### 2.5 实现步骤

| Step | 内容 | 预估文件数 |
|------|------|-----------|
| 1 | 定义 `coding-agent/types.ts` | 1 |
| 2 | 实现 `CodingBackend` 接口 + `ClaudeCodeBackend` | 1 |
| 3 | 实现 `OpenCodeBackend` | 1 |
| 4 | 实现 `CodingAgentAdapter` | 1 |
| 5 | 实现 `CoderAgent` (sub-agent) | 1 |
| 6 | 扩展 `AgentRole`, `RuntimeRole`, config 类型 | 3 (修改) |
| 7 | 扩展 `DelegationEngine` 支持 coder 角色 | 1 (修改) |
| 8 | 添加配置项到 `default-config.ts` | 1 (修改) |
| 9 | 单测 + 集成测试 | 2-3 |

---

## Blueprint 文档更新建议

以下是 `docs/blue-print.md` 需要同步更新的内容：

### 4.4 Filesystem 新增内容

```
当前状态：
- `已实现`：Bandry Home 路径规划、配置化路径覆盖、工作区与追踪目录能力。
+ `已实现`：全局资源中心（~/.bandry/resources/），支持 agent 自动评估转存与索引。
- `规划中`：更完善的任务资产治理与清理策略。
```

### 4.1 Orchestration 新增内容

```
当前状态：
+ `已实现`：Coding Agent 适配层，通过通用接口对接 claude-code / opencode 等外部工具。
+ `已实现`：coder 角色纳入 DAG 多 Agent 框架。
```

### 第 5 节 本地目录结构更新

```text
~/.bandry/
├── ...
├── resources/                     # 全局资源中心
│   ├── manifest.jsonl             # 资源索引
│   └── artifacts/                 # 资源文件存储
│       ├── document-xxx.md
│       └── data-xxx.json
├── ...
└── workspaces/
    └── task_*/
        ├── input/
        ├── staging/
        ├── coding/                # ← 新增: coding agent 工作目录
        └── output/
```

### 9.3 Roadmap 新增

```
- 全局资源中心：agent 自动 curation + 跨任务资源复用。
- Coding Agent 适配层：通用接口对接外部 coding agent（claude-code / opencode）。
```

---

## 风险与开放问题

| # | 问题 | 初步想法 |
|---|------|---------|
| 1 | manifest.jsonl 并发写冲突 | 目前单进程场景不会冲突；后续可加文件锁 |
| 2 | curation LLM 调用成本 | 仅在有 output 产出时触发，且输入量小（文件名 + 预览），成本可控 |
| 3 | claude code CLI 版本兼容性 | 封装在 backend 内，版本检测 + 降级策略 |
| 4 | opencode 是否有稳定的非交互模式 | 需要调研确认，如果不支持可先标记为 experimental |
| 5 | 资源中心增长到很大怎么办 | 加 TTL 过期策略 + 手动/自动清理，Phase 1 先不做 |
| 6 | coding agent 执行时间长如何反馈进度 | 通过 stdout streaming 解析进度，映射到 chat:update 事件 |
