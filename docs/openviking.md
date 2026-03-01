# OpenViking 记忆系统技术文档

## 概述

Bandry 通过集成 [OpenViking](https://github.com/volcengine/OpenViking)（字节跳动火山引擎开源的 AI Agent 上下文数据库）为 Agent 提供长期记忆能力。OpenViking 以本地 Python 微服务形式运行，由 Electron 主进程管理其生命周期。

### 核心价值

- **跨会话记忆**：用户偏好、历史决策、项目上下文在对话之间持久保存
- **语义检索**：基于向量检索而非关键词匹配，理解用户意图
- **自动沉淀**：对话结束后自动提取并存储长期记忆，无需用户手动操作
- **分层上下文**：L0（摘要）/ L1（大纲）/ L2（全文）按需加载，节省 token

---

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│  Electron 主进程                                                 │
│                                                                  │
│  bootstrap.ts                                                    │
│    └── syncOpenViking()                                          │
│          ├── OpenVikingProcessManager.start()                    │
│          │     ├── prepareEnvironment()  // patch + warm-up      │
│          │     ├── removeStaleLockFiles()  // 清理残留 LOCK      │
│          │     ├── writeOpenVikingConfig()  // 生成 ov.conf      │
│          │     ├── resolveOpenVikingCommand()  // 解析命令路径    │
│          │     ├── spawn(openviking serve)  // 启动 Python 进程  │
│          │     ├── waitForHealthy()  // GET /health 轮询         │
│          │     └── attachCrashWatcher()  // 崩溃监听+自动重启    │
│          │                                                       │
│          ├── OpenVikingMemoryProvider(httpClient)                 │
│          └── chatAgent.setMemoryProvider(provider)                │
│                                                                  │
│  ToolPlanningChatAgent.send()                                    │
│    └── MiddlewarePipeline                                        │
│          ├── ...其他中间件...                                      │
│          ├── MemoryMiddleware                                     │
│          │     ├── beforeLLM: injectContext() → 注入记忆          │
│          │     └── onResponse: storeConversation() → 存储对话    │
│          └── ...                                                 │
│                                                                  │
│  ToolExecutor                                                    │
│    └── memory_search 工具 → 主动检索记忆                          │
│                                                                  │
│  IPC Handlers                                                    │
│    ├── memory:status   → 运行状态                                │
│    ├── memory:search   → 语义搜索                                │
│    ├── memory:add-resource → 添加资源                            │
│    └── memory:list-resources → 浏览资源                          │
└─────────────────────────────────────────────────────────────────┘
        │ HTTP (127.0.0.1:1933)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│  OpenViking Python 进程 (FastAPI/Uvicorn)                        │
│                                                                  │
│  ├── AGFS (Agent File System)  ← Rust binary, 端口 1833         │
│  │     └── 虚拟文件系统: viking://user/memories, viking://agent/ │
│  ├── VectorDB (本地向量数据库)                                    │
│  │     └── 存储路径: ~/.bandry/resources/openviking/data/vectordb│
│  ├── Embedding (火山引擎 / OpenAI)                               │
│  │     └── 文本向量化, 语义检索                                   │
│  ├── VLM (DeepSeek / 火山引擎 / OpenAI)                          │
│  │     └── 语义处理, 摘要生成                                    │
│  └── Session Manager                                             │
│        └── 会话管理, 记忆提取                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 文件结构

```
src/main/memory/
├── contracts/
│   └── types.ts                  # MemoryProvider 接口、ContextChunk、Conversation 等类型
├── extraction/
│   ├── fact-extractor.ts         # LLM 事实提取器
│   └── prompts.ts                # 提取/摘要提示词
├── layered/
│   └── layered-memory-provider.ts  # 本地文件实现（备用）
└── openviking/
    ├── index.ts                  # 模块导出
    ├── types.ts                  # OpenViking API 类型
    ├── config-builder.ts         # 生成 ov.conf 配置文件
    ├── python-resolver.ts        # 解析 Python/openviking 命令路径
    ├── process-manager.ts        # 进程生命周期管理
    ├── http-client.ts            # OpenViking HTTP API 客户端
    ├── memory-provider.ts        # MemoryProvider 接口实现
    └── tests/
        └── memory-provider.test.ts

src/main/orchestration/chat/
├── middleware/
│   ├── memory.ts                 # MemoryMiddleware（被动记忆）
│   └── loader.ts                 # 中间件加载，根据 memoryProvider 选择实现
├── tools/
│   └── memory-tool.ts            # memory_search 工具（主动记忆）
├── tool-executor.ts              # 工具路由，包含 memory_search
└── planner-chat-agent.ts         # 主 Agent，持有 memoryProvider

scripts/
├── setup-python-env.sh           # 安装便携版 Python + OpenViking
└── ensure-openviking.sh          # pnpm dev 预检（幂等）
```

---

## 记忆能力类型

### 被动记忆（自动触发）

每次对话自动执行，用户无感知。

**注入阶段**（`MemoryMiddleware.beforeLLM`）：
1. 提取最新一条 user 消息作为查询
2. 调用 `OpenVikingMemoryProvider.injectContext(sessionId, query)`
3. 向量检索 `viking://user/memories` + `viking://agent/memories`
4. 命中结果格式化为 `# Memory Context` 系统消息
5. 插入到 LLM messages 最前面

**存储阶段**（`MemoryMiddleware.onResponse`）：
1. 提取 user + assistant 消息（最近 4 条）
2. 防抖 30 秒后提交到 OpenViking
3. 通过签名去重，避免重复 commit
4. OpenViking 异步执行记忆提取和向量化

### 主动记忆（Agent 决策触发）

规划器判断需要查历史记忆时调用 `memory_search` 工具。

**触发条件**：用户问题涉及回忆、历史偏好、之前的决策等。

**执行流程**：
1. 规划器输出 `{ action: "tool", tool: "memory_search", input: { query: "..." } }`
2. `tool-executor.ts` 路由到 `executeMemorySearch()`
3. 调用 `memoryProvider.injectContext()` 执行检索
4. 返回结果作为 ToolObservation 供后续规划参考

### 两者关系

被动记忆每次一定触发；主动记忆由规划器自主决定。如果被动注入已提供足够上下文，规划器通常不会再调用 `memory_search`。两者互补，不重复。

---

## 配置

### 配置项

| 配置项 | 默认值 | 说明 |
|-------|--------|------|
| `features.enableMemory` | `false` | 全局开关 |
| `openviking.enabled` | `true` | OpenViking 子开关 |
| `openviking.host` | `127.0.0.1` | 监听地址 |
| `openviking.port` | `1933` | HTTP 端口（自动寻找可用端口） |
| `openviking.startTimeoutMs` | `20000` | 启动健康检查超时 |
| `openviking.healthcheckIntervalMs` | `500` | 健康检查轮询间隔 |
| `openviking.memoryTopK` | `6` | 每次检索返回最大记忆条数 |
| `openviking.memoryScoreThreshold` | `0.35` | 低于此分数的记忆被过滤 |
| `openviking.commitDebounceMs` | `30000` | 对话存储防抖时间 |
| `openviking.targetUris` | `["viking://user/memories", "viking://agent/memories"]` | 检索目标 URI |

### 配置方式

1. **前端 Settings 页面**（推荐）：打开 Settings → 记忆能力（OpenViking）区域 → 打开开关 → 保存
2. **用户配置文件** `~/.bandry/config/config.json`：

```json
{
  "features": { "enableMemory": true },
  "openviking": { "enabled": true }
}
```

保存设置后**无需重启**，`syncOpenViking()` 会自动启动或关闭 OpenViking 进程。

### Embedding 模型选择

`config-builder.ts` 自动从已配置的 provider 中选择 embedding 模型：

| 条件 | 模型 | 维度 |
|-----|------|------|
| Volcengine API Key 存在 | `doubao-embedding-vision-250615` | 1024 |
| 否则使用 OpenAI | `text-embedding-3-large` | 3072 |

---

## 启动流程

### 开发环境

```bash
pnpm dev
```

执行顺序：

1. `ensure-openviking.sh` — 检查 `python-env/venv` 是否存在，不存在则自动运行 `setup-python-env.sh`
2. `setup-python-env.sh`（仅首次）:
   - 下载 [python-build-standalone](https://github.com/astral-sh/python-build-standalone) 便携版 Python 3.12
   - 创建 venv
   - `pip install openviking httpx[socks]`
3. Electron 启动 → `bootstrap.ts` → `syncOpenViking()`
4. `prepareEnvironment()`:
   - Patch AGFS 超时 5s → 30s（macOS 首次启动需要）
   - Warm up agfs-server binary（触发 macOS Gatekeeper 缓存）
5. 生成 `ov.conf` → spawn `openviking serve` → 健康检查通过
6. 注入 `MemoryMiddleware` 到 chat pipeline

### 进程管理

| 事件 | 行为 |
|-----|------|
| Settings 保存（enableMemory=true） | `syncOpenViking()` 启动进程 |
| Settings 保存（enableMemory=false） | `shutdownOpenViking()` 停止进程 |
| 运行期间进程意外崩溃 | crash watcher 检测 → 清理 stale lock → 自动重启（最多 3 次） → 重建 MemoryProvider |
| 自动重启全部失败 | 通知 bootstrap 清空引用，记忆功能优雅降级 |
| 窗口全部关闭 | `flush()` + `stop()` |
| 应用退出前 | `flush()` + `stop()` |

### 容错与自动恢复

OpenViking 子进程可能因 OOM、Python 异常、外部信号等原因在运行期间意外退出。`process-manager.ts` 提供了两层保障机制：

#### Stale Lock 清理

LevelDB 使用文件锁（`vectordb/<collection>/store/LOCK`）保证单进程访问。如果进程异常退出未释放锁，下次启动会报 `Resource temporarily unavailable`。

`removeStaleLockFiles()` 在每次 `doStart()` 启动子进程前，遍历 `vectordb/` 下所有 collection 的 `store/LOCK` 文件并删除。此时 `this.child` 已确认为空（要么首次启动，要么上一个进程已 stop/崩溃），因此删除是安全的。

#### Crash Watcher 自动重启

`attachCrashWatcher()` 在 health check 通过后挂载到子进程的 `exit` 事件上：

| 参数 | 值 | 说明 |
|-----|------|------|
| `MAX_RESTART_ATTEMPTS` | 3 | 最大连续重启次数 |
| `RESTART_DELAY_MS` | 2000 | 基础延迟，实际延迟 = 基础延迟 × 当前重试次数 |
| `RESTART_ATTEMPTS_RESET_MS` | 120000 | 进程稳定运行超过此时长后重置重试计数 |

**恢复流程**：

1. 子进程 `exit` 事件触发，crash watcher 清空 `this.child` 和 `this.runtime`
2. 判断重试次数：若进程已稳定运行 > 2 分钟则重置计数
3. 若未耗尽重试次数，等待递增延迟后调用 `start()` 重启（包含 stale lock 清理）
4. 重启成功：通过 `onCrash` 回调通知 `bootstrap.ts`，重建 `OpenVikingMemoryProvider` 并重新绑定到 chat agent
5. 重启失败或重试耗尽：回调 `willRestart: false`，bootstrap 清空所有 OpenViking 引用，记忆功能优雅降级

**安全边界**：

- `stop()` 在 kill 子进程前先将 `this.child` 置空，crash watcher 检查 `this.child !== child` 后直接忽略，不会误触发重启
- crash watcher 在 `doStart()` 成功通过 health check 后才挂载，启动阶段的失败不会触发自动重启（由调用方处理）
- `startPromise` 去重机制保证 crash watcher 的 `start()` 调用与外部调用不会并发启动多个进程

---

## 数据存储

所有数据位于 `~/.bandry/resources/openviking/data/`：

```
~/.bandry/resources/openviking/
├── ov.conf                    # 自动生成的 OpenViking 配置
└── data/
    ├── vectordb/              # 向量数据库（本地）
    │   └── context/           # 统一上下文集合
    ├── viking/                # AGFS 虚拟文件系统
    │   └── temp/              # 解析临时目录
    └── .agfs/
        └── config.yaml        # AGFS 配置（自动生成）
```

---

## IPC 接口

### memory:status

返回 OpenViking 运行状态。

```typescript
type MemoryStatusResult = {
  enabled: boolean;   // 配置是否开启
  running: boolean;   // 进程是否运行且健康
  url?: string;       // HTTP 服务地址
};
```

### memory:search

执行语义搜索。

```typescript
// Input
type MemorySearchInput = { query: string; targetUri?: string; limit?: number };

// Output
type MemorySearchResult = {
  items: Array<{ uri: string; abstract?: string; score?: number; category?: string }>;
  total: number;
};
```

### memory:add-resource

添加外部资源（URL、文件、目录）到 OpenViking。

```typescript
type MemoryAddResourceInput = { path: string };
type MemoryAddResourceResult = { rootUri: string };
```

### memory:list-resources

浏览 OpenViking 虚拟文件系统目录。

```typescript
type MemoryListResourcesInput = { uri: string };
type MemoryListResourcesResult = {
  entries: Array<{ name: string; uri: string; type: "file" | "directory" }>;
};
```

---

## 前端集成

### Settings 页面

`src/renderer/components/settings/global-config-manager.tsx`

- 记忆能力卡片：开关、Host、Port、Top K、Score Threshold
- 运行状态指示器（运行中/未运行/已禁用 + 刷新按钮）

### Copilot 页面

`src/renderer/components/views/copilot.tsx`

- 头部 "Memory Active" 紫色徽章（OpenViking 运行时显示）

---

## 代理兼容

系统代理（Clash、V2Ray 等）会干扰 OpenViking 内部 localhost 通信。`process-manager.ts` 在 spawn OpenViking 进程时自动处理：

- 清除 `http_proxy`、`https_proxy`、`all_proxy`（及大写变体）
- 设置 `NO_PROXY=localhost,127.0.0.1,::1`
- 安装 `httpx[socks]`（Volcengine SDK 需要）

无论代理开启或关闭，OpenViking 均可正常运行。

---

## 调试

### 日志关键字

| 日志 | 含义 |
|-----|------|
| `[OpenViking] started at http://...` | 启动成功 |
| `[OpenViking] Patched AGFS timeout` | AGFS 超时已修正（首次） |
| `[OpenViking] AGFS binary warm-up done` | macOS Gatekeeper 预热完成 |
| `[OpenViking] Removed stale lock: ...` | 启动前清理了残留的 LevelDB LOCK 文件 |
| `[OpenViking] Process exited unexpectedly` | 运行期间子进程崩溃，crash watcher 已检测 |
| `[OpenViking] Scheduling restart in ...ms` | 正在等待延迟后自动重启 |
| `[OpenViking] Auto-restart succeeded` | 崩溃后自动重启成功 |
| `[OpenViking] Max restart attempts exhausted` | 连续 3 次重启均失败，记忆功能已降级 |
| `POST /api/v1/search/search` | 记忆检索（被动或主动） |
| `POST /api/v1/sessions/.../commit` | 对话已提交，触发记忆提取 |
| `[OpenViking] failed to start` | 启动失败，查看后续错误详情 |

### 手动验证

```bash
# 健康检查
curl --noproxy '*' http://127.0.0.1:1933/health

# 搜索记忆
curl --noproxy '*' -X POST http://127.0.0.1:1933/api/v1/search/search \
  -H "Content-Type: application/json" \
  -d '{"query": "用户偏好", "limit": 5}'

# 查看数据目录
ls -la ~/.bandry/resources/openviking/data/vectordb/
```

### 常见问题

| 问题 | 原因 | 解决 |
|-----|------|------|
| AGFS timeout | macOS Gatekeeper 首次扫描 | 自动 warm-up 已处理；若仍超时，手动运行一次 `agfs-server --help` |
| SOCKS proxy ImportError | 系统代理 + 缺少 socksio | `pip install httpx[socks]`（setup 脚本已包含） |
| Agent 无法回忆 | 记忆未处理完 / scoreThreshold 过高 | 等 1-2 分钟或降低 threshold |
| 端口占用 | 残留 AGFS 进程 | `pkill -f agfs-server` |
| `Resource temporarily unavailable` (LOCK) | 进程异常退出残留 LevelDB 文件锁 | 启动前已自动清理；若仍出现可手动 `rm ~/.bandry/resources/openviking/data/vectordb/*/store/LOCK` |
| 运行中记忆突然不可用 | 子进程崩溃 | crash watcher 会自动重启（最多 3 次），查看日志确认恢复状态 |

---

## 测试

```bash
# 记忆模块单元测试
pnpm test src/main/memory/

# 中间件集成测试
pnpm test src/main/orchestration/chat/middleware/tests/memory-integration.test.ts

# 中间件加载顺序测试
pnpm test src/main/orchestration/chat/middleware/tests/loader-order.test.ts

# 全部测试
pnpm test
```
