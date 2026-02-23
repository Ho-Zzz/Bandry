# Bandry MVP 技术架构总览

**核心定位**：基于 Electron 的本地优先 Mac App，由云端大模型 API 驱动推理，本地引擎负责编排、沙盒执行与资源记忆管理。

## 1. 核心技术栈选型

| **模块**         | **技术选型**                              | **工程说明**                                 |
| -------------- | ------------------------------------- | ---------------------------------------- |
| **底层框架**       | Electron + React                      | 负责跨进程通信 (IPC)、原生系统交互和可视化 UI              |
| **大模型接入**      | 云端 API (OpenAI / Claude / DeepSeek 等) | 专注本地化工作流编排与上下文管理                         |
| **多 Agent 引擎** | 中心化路由 (自研轻量级 Supervisor)              | Lead Agent 负责 DAG 任务拆解与分发，Sub-Agent 负责执行 |
| **工具与通信**      | MCP (Model Context Protocol)          | 标准化本地工具接入（数据库、Git、文件系统等）                 |
| **记忆与资源**      | OpenViking (字节开源框架)                   | 基于纯 Markdown 的 L0/L1/L2 三层文件范式记忆，免去复杂向量库 |
| **自动化编排**      | Node.js EventEmitter + node-cron      | 实现任务状态机、A -> B 触发器和定时任务派发                |

---

## 2. 核心模块与运行机制

**模块一：中心化调度中心 (Lead Agent Router)**

- **职责**：接收用户自然语言意图，拆解为有向无环图 (DAG) 任务队列，分配给具备特定 Skills 的 Sub-Agent。
    
- **工作区隔离**：为每个根任务生成独立的物理工作区（如 `task_170845`），包含 `input/`、`staging/`、`output/` 目录。
    
- **历史审计**：在工作区生成 `trace.jsonl`，记录所有 API 请求、工具调用和状态流转，用于 UI 展示和失败重试。
    

**模块二：沙盒化执行引擎 (Sandbox & Execution)**

- **职责**：安全地执行 Bash 命令和 MCP 工具。
    
- **路径锁定**：使用 Node.js `child_process`，将运行时的 `cwd` 强制绑定在当前任务工作区内。
    
- **混合 HITL (Human-in-the-loop) 机制**：
    
    - **白名单静默执行**：`ls`, `cat`, 工作区内的 `ffmpeg` 转换等安全操作自动通过。
        
    - **正则拦截与 IPC 阻断**：检测到 `rm`、越权写文件、网络请求等高危操作时，暂停线程，通过 Electron IPC 唤起前端弹窗，等待用户点击“授权”或“拒绝”。
        

**模块三：本地资源与记忆中枢 (Memory & Context)**

- **职责**：管理用户沉淀的知识和 Agent 的长期记忆。
    
- **OpenViking 挂载**：将应用本地的 `~/.bandry/resources/` 挂载为知识空间。
    
- **动态上下文**：Agent 需要提取历史知识时，先读取极简的 L0 (摘要) 或 L1 (大纲)，按需再读取 L2 (原文件)，避免 Context Window 爆炸。
    

**模块四：自动化与状态机 (Automation Engine)**

- **职责**：管理任务的生命周期与后台静默运行。
    
- **核心状态**：`PENDING` (排队中) -> `RUNNING` (执行中) -> `PAUSED_FOR_HITL` (等待授权) -> `COMPLETED` (完成) / `FAILED` (失败)。
    
- **触发器**：监听状态变更事件，当任务 A 状态变为 `COMPLETED`，提取其 `output/` 路径作为参数，触发后续任务 B。
    

---

## 3. 本地目录结构设计 (Data Flow)

作为本地优先的 App，清晰的文件系统是产品的灵魂。建议的本地目录结构如下：

Plaintext

```
~/.bandry/
├── config/                 # 存放用户 API Keys、全局设置、自动化 cron 配置
├── resources/              # OpenViking 接管的知识库目录 (Markdown 沉淀)
├── plugins/                # MCP Servers 和自定义 Skills 脚本
└── workspaces/             # 任务执行沙盒
    ├── task_1001/          # 具体的任务实例
    │   ├── input/          # 任务输入 (用户拖拽的文件)
    │   ├── staging/        # Sub-Agent 中间态处理文件
    │   ├── output/         # 最终交付物 (后续沉淀到 resources 目录)
    │   └── trace.jsonl     # 结构化执行日志
    └── task_1002/
```


## 方案细化设计
### 一、Lead Agent 与 Sub-Agent 调度系统

整个调度系统分为两个核心子系统：**中间件管道（Middleware Pipeline）**负责处理数据的流入流出与状态拦截；**异步委派引擎（Delegation Engine）**负责任务的拆解与多进程沙盒执行。

#### 一、 中间件管道设计 (The Middleware Pipeline)

在 Node.js 中，我们采用类似 Koa.js 的“洋葱模型”或“生命周期钩子（Lifecycle Hooks）”来设计中间件。所有用户请求、大模型响应、工具调用，都必须流经一个统一的 `SessionContext`（会话上下文）对象。

**1. 生命周期钩子定义**

每个中间件可以挂载在以下四个生命周期节点：

- `onRequest`: 收到用户输入，准备发给 Lead Agent 前。
    
- `beforeLLM`: 组装完 Prompt，马上要发起 API 网络请求前。
    
- `afterLLM`: 收到大模型 API 返回的 Raw Data 后。
    
- `onResponse`: 结果处理完毕，准备返回给前端 UI 或进行下一步行动前。
    

**2. 核心中间件链配置 (按执行顺序)**

|**中间件名称**|**挂载节点**|**核心职责与工程实现细节**|
|---|---|---|
|**Workspace Middleware**|`onRequest`|**沙盒环境分配**：为当前任务生成或定位到本地路径（如 `~/.bandry/workspaces/task_123/`）。将其绝对路径注入 `SessionContext.env`，确保后续所有工具调用都锁定在此目录下。|
|**OpenViking Memory Middleware**|`beforeLLM`<br><br>  <br><br>`onResponse`|**记忆注入与异步沉淀**：<br><br>  <br><br>- _读 (`beforeLLM`)_：去本地 `resources/` 读取 OpenViking 的 L0/L1 摘要，作为 `SystemMessage` 注入，提供长期记忆。<br><br>  <br><br>- _写 (`onResponse`)_：将本轮对话推入 Node.js 异步队列。利用 `lodash.debounce` 设 30 秒防抖，后台悄悄调用小模型提取 Facts 并写入 Markdown，绝不阻塞当前 UI 渲染。|
|**Local Resource Middleware**|`beforeLLM`|**本地文件预读**：扫描用户拖入 `input/` 目录的文件。若是图片转为 Base64；若是纯文本提取前 2000 个 Token 注入 Context。避免 Agent 反复调用“读文件”工具浪费时间。|
|**Output Validation Middleware**|`afterLLM`|**JSON 强校验（防腐层）**：Lead Agent 的输出必须是严格的 DAG (有向无环图) JSON。如果模型输出格式损坏，此层直接拦截，并利用 Zod 等库生成错误提示，**内部自动发起重试**，不让脏数据流入执行器。|
|**Concurrency Limit Middleware**|`afterLLM`|**并发熔断器**：解析 JSON 中的 Sub-Agent 调用数量。为了保护 Mac 本地 CPU/内存，硬编码限制单次并发上限（如 `MAX_WORKERS = 3`）。超出部分做截断或放入 `PENDING` 队列。|
|**Clarification / HITL Middleware**|`afterLLM`|**人类介入（中断机制）**：检测到 Agent 试图执行高危 Bash 命令，或主动调用了 `ask_user` 工具。立即调用 `Command(goto=END)` 中止流转，通过 Electron IPC 管道向渲染进程（前端 Vue/React）发送事件，弹出确认对话框。|


#### 二、 Sub-Agent 异步委派系统 (The Delegation Engine)

Lead Agent 只是“大脑”（规划 DAG），真正干活的手脚是 Sub-Agents。在 Node.js 环境下，我们绝不能在主线程里跑耗时的 Agent 任务（会卡死整个 Electron App）。

**1. 委派协议与工具触发**

Lead Agent 唯一能调用的核心工具是 `delegate_sub_tasks`。它通过 API 输出如下结构的指令：

```json
{
  "tool": "delegate_sub_tasks",
  "payload": {
    "tasks": [
      {
        "sub_task_id": "sub_01",
        "agent_role": "WebResearcher",
        "prompt": "搜索 2026 RAG 框架最新方案...",
        "dependencies": [],
        "write_path": "staging/research.md"
      },
      {
        "sub_task_id": "sub_02",
        "agent_role": "BashExpert",
        "prompt": "根据 research.md 生成一段 python 抓取脚本并执行",
        "dependencies": ["sub_01"],
        "write_path": "output/code.py"
      }
    ]
  }
}
```

**2. 调度器与独立执行环境 (Worker Threads/Child Process)**

当中间件放行了这个工具调用，Bandry 后台调度引擎接管：

- **非阻塞返回**：调度器立刻给 Lead Agent 返回一条消息：“_任务已收到，正在后台并行处理。_” 此时 Lead Agent 的本次思考周期结束。
    
- **依赖图解析**：调度引擎解析 DAG，发现 `sub_01` 无依赖，立刻启动；`sub_02` 压入等待队列。
    
- **进程级沙盒隔离 (核心)**：对于每一个启动的 Sub-Agent，系统使用 Node.js 的 `child_process.fork()` 或 `worker_threads` 启动一个**完全独立的执行环境**。
    
    - _权限剥夺_：在传给 Worker 的初始化参数中，严格限制它的 `cwd` 为当前任务工作区，并且**只注入符合其 Role 的 MCP 工具集**（例如 `BashExpert` 才有权调用终端，`WebResearcher` 只能联网）。
        

**3. 事件驱动的状态反馈 (Event-Driven State Machine)**

子进程和主进程之间通过 IPC 消息（或 Event Emitter）通信：

- 当 `sub_01` (Worker 线程) 跑完，把结果写入了 `staging/research.md`，它向主进程发送一个事件：`{ event: "TASK_COMPLETED", task_id: "sub_01" }`。
    
- 主进程监听器收到后，更新任务状态机。检查发现 `sub_02` 的前置依赖满足了，立刻启动 `sub_02` 的 Worker。
    
- 当所有子任务都 `COMPLETED`，调度引擎重新唤醒 Lead Agent，通过注入一条内部系统消息：“_所有委派的子任务已完成，请检查工作区 output 目录并向用户汇报。_”

#### 三、 Bandry 内置的 Sub-agent 类型建议

为了让 Lead Agent 知道该把任务派给谁，系统启动时会向 Lead Agent 注册以下几种本地原生的“电子员工”：

| **子智能体角色**       | **核心挂载工具**                       | **适用场景**                                              | 描述                                                                 |
| ---------------- | -------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| **Researcher**   | `read_local_file`                | 负责查资料、阅读长文档并生成摘要（不具备写文件权限，结果通过内存返回）。                  | 不干脏活。拥有全局记忆，负责意图理解、DAG 规划、最终交付物验收、与用户对话。                           |
| WebResearcher    | `web_search`, `fetch_url`        | 需要执行网络调研任务                                            | 挂载 `web_search`, `fetch_url` 工具。专门负责高 Token 消耗的网页阅读和信息摘要提取。        |
| **BashOperator** | `execute_bash` (受严格白名单与路径沙盒限制)   | 专门执行终端命令，如 `git clone`, `npm install`, 调用 `ffmpeg` 等。 | 挂载 `bash_executor`（带正则白名单）和本地环境变量。负责执行 Git、文件重命名、脚本运行等系统级操作。       |
| **Writer**       | `write_to_file`, `edit_markdown` | 负责将中间数据汇总，按要求格式化，并保存到工作区的 `output/` 目录下。              | 纯粹的逻辑推理 Agent，不挂载外部网络和终端工具。只给它读写工作区 Markdown/CSV 的权限，专心做数据归纳和报告撰写。 |
### 二、数字员工与LLM
这份设计稿彻底理清了 Bandry 中“数字员工”的物理结构。现在有了一个非常坚固的地基：

1. **数据层**通过 SQLite 持久化了 `Provider -> Employee` 的解耦关系。
    
2. **逻辑层**通过 `AgentType` 锁定了模型的行为边界。
    
3. **架构层**通过 Adapter 模式将外部 API 的不确定性隔离在了系统之外。
    

有了这个基石，我们可以开始真正让这些员工“动起来”了！

#### 1. 核心类型定义 (TypeScript Interfaces)

在 Bandry 的代码库中，我们需要定义三层核心数据结构：**厂商/凭证 (Provider) -> 支持的模型 (Model) -> 实例化的员工 (Agent)**。

```TypeScript
// src/common/types/agent.ts

/**
 * 1. 员工类型（核心抽象）
 * 由它决定了后续传递给 Adapter 时的默认参数（Temperature、Tools支持等）
 */
export type AgentType = 
  | "planner"     // 规划型：需要 thinking/reasoning 能力 (如 o3-mini, R1)
  | "generalist"  // 综合型：需要极强的 function calling 和多轮对话 (如 Claude 3.5 Sonnet)
  | "executor"    // 执行型：快速、低成本、死板执行 (如 Haiku, Flash)
  | "specialist"; // 专家型：针对特定领域的多模态生成 (如 Nano Banana, Veo)

/**
 * 2. 全局厂商凭证 (Provider Configuration)
 * 对应 UI 第一步：全局设置 -> 模型接入
 */
export interface ProviderConfig {
  id: string;              // uuid
  provider_name: string;   // 'openai' | 'anthropic' | 'google' | 'custom_api'
  api_key: string;         // 加密存储的 API Key
  base_url?: string;       // 方便接入第三方中转或本地 Ollama/vLLM
  is_active: boolean;
  created_at: number;
}

/**
 * 3. 实例化的数字员工 (The Digital Employee / Agent)
 * 对应 UI 第二步：创建员工
 */
export interface EmployeeConfig {
  id: string;              // uuid，例如 'agent_frontend_dev_01'
  name: string;            // 员工名称，如 "资深前端工程师"
  avatar?: string;         // 头像（本地路径或 Base64）
  type: AgentType;         // 员工类型，决定其在 DAG 图中的站位
  
  // 关联的物理模型
  provider_id: string;     // 绑定上方的 ProviderConfig ID
  model_id: string;        // 具体的模型名称，如 'claude-3-5-sonnet-20241022'
  
  // 角色与能力
  system_prompt: string;   // 人设与边界指令
  mcp_tools: string[];     // 该员工被授权使用的本地工具/MCP Server 列表，如 ['local_fs_read', 'bash_executor']
  
  // 高级参数（通常被 AgentType 隐藏，但允许高阶用户覆盖）
  override_params?: {
    temperature?: number;
    max_tokens?: number;
  };
  
  created_at: number;
  updated_at: number;
}
```

---

#### 2. 本地数据库选型与存储设计

**选型建议：SQLite + `better-sqlite3`**

作为 Electron Mac App，绝对不要让用户安装 MySQL 或 MongoDB。

SQLite 是本地桌面端唯一的王者。配合 Node.js 的 `better-sqlite3` 库，它是同步执行的，性能极高，且整个数据库就是一个位于 `~/.bandry/config/bandry.db` 的文件，极其便于用户备份和迁移。

**数据库表结构设计 (SQL Schema)**：

```sql
-- 1. 厂商凭证表
CREATE TABLE providers (
    id TEXT PRIMARY KEY,
    provider_name TEXT NOT NULL,
    api_key TEXT NOT NULL, -- 建议在存入前用系统密钥链进行简单的 AES 加密
    base_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER
);

-- 2. 数字员工表
CREATE TABLE employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT,
    type TEXT NOT NULL, -- 'planner', 'generalist', 'specialist', 'executor'
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    system_prompt TEXT,
    mcp_tools TEXT, -- JSON 字符串，例如 '["web_search", "bash"]'
    override_params TEXT, -- JSON 字符串
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY(provider_id) REFERENCES providers(id)
);
```

---

#### 3. 前后端通信开发指南 (Electron IPC)

在 Electron 中，前端 (React) 是不能直接读写 SQLite 或调用本地 Bash 的。一切必须通过 IPC (Inter-Process Communication) 桥接。

**后端 (Main Process - Node.js)**：

暴露 CRUD 接口给前端调用。

```typescript
// main/ipc/employeeHandler.ts
import { ipcMain } from 'electron';
import Database from 'better-sqlite3';

const db = new Database('~/.bandry/config/bandry.db');

export function registerEmployeeHandlers() {
  // 获取员工列表
  ipcMain.handle('get-employees', () => {
    return db.prepare('SELECT * FROM employees').all();
  });

  // 创建新员工
  ipcMain.handle('create-employee', (event, employeeData: EmployeeConfig) => {
    const stmt = db.prepare(`
      INSERT INTO employees (id, name, type, provider_id, model_id, system_prompt, mcp_tools, created_at, updated_at)
      VALUES (@id, @name, @type, @provider_id, @model_id, @system_prompt, @mcp_tools, @created_at, @updated_at)
    `);
    // 需要把 mcp_tools 序列化为 JSON 字符串再存入
    stmt.run({ ...employeeData, mcp_tools: JSON.stringify(employeeData.mcp_tools) });
    return { success: true };
  });
}
```

**前端 (Renderer Process - React)**：

在页面上调用这些桥接方法。

```TypeScript
// renderer/api/index.ts
export const fetchEmployees = async () => {
  return await window.electronAPI.invoke('get-employees');
};

export const createEmployee = async (data) => {
  return await window.electronAPI.invoke('create-employee', data);
};
```

---

#### 4. LLM API Adapter 架构指引 (Blueprint)

这是最核心也最脏的活儿，你需要用**适配器模式 (Adapter Pattern)** 将各大厂商千奇百怪的 API 抹平。

**1. 统一的内部协议 (Bandry Standard Protocol)**

无论外部模型是什么，Bandry 系统内部的 Lead Agent 调度和存储都只认一种格式。

```TypeScript
// Bandry 发给 Adapter 的标准请求
interface BandryRequest {
  messages: { role: "system" | "user" | "assistant", content: string }[];
  tools?: BandryTool[]; // 统一的工具格式
  agentType: AgentType; // 适配器据此注入默认参数！
}

// Adapter 返回给 Bandry 的标准响应
interface BandryResponse {
  content: string;
  tool_calls?: { name: string, arguments: any }[]; // 抹平不同厂商的工具调用返回格式
  media_paths?: string[]; // specialist 专用的本地多媒体路径返回
}
```

**2. Adapter 工厂模式 (The Router)**

根据分配给该员工的 `provider_name` 和 `type`，动态路由到对应的处理类。

```TypeScript
// 伪代码示例
class ModelAdapterFactory {
  static async execute(employee: EmployeeConfig, request: BandryRequest): Promise<BandryResponse> {
    const provider = getProvider(employee.provider_id);
    
    // 1. 如果是专家型 (Specialist) - 处理多模态
    if (employee.type === 'specialist') {
       if (employee.model_id.includes('nano-banana')) {
           return new NanoBananaAdapter(provider.api_key).generateImage(request);
       }
       if (employee.model_id.includes('veo')) {
           return new VeoVideoAdapter(provider.api_key).generateVideo(request);
       }
       // ... 其他 Specialist
    }

    // 2. 文本/执行型 - 处理标准对话与 Function Calling
    const baseParams = this.getDefaultParams(employee.type); // 根据类型获取默认 temperature 等
    
    switch (provider.provider_name) {
      case 'anthropic':
        return new AnthropicAdapter(provider.api_key).chat({...request, ...baseParams});
      case 'openai':
        return new OpenAIAdapter(provider.api_key).chat({...request, ...baseParams});
      default:
        throw new Error("Unsupported provider");
    }
  }

  // 这里的默认参数就是我们前面讨论的精华
  private static getDefaultParams(type: AgentType) {
    if (type === 'executor') return { temperature: 0.0 };
    if (type === 'planner') return { temperature: 0.7 };
    return { temperature: 0.2 }; // generalist
  }
}
```

**为什么 Specialist 需要特殊的 Adapter？**

因为像 Nano Banana（图像）或 Veo（视频）这类模型，它们的 API 流程通常是：发送 Prompt -> 获取 Task ID -> 轮询等待生成完成 -> 下载媒体文件到本地。

`SpecialistAdapter` 的职责就是**把这段漫长的异步下载过程封装起来**，最后只返回一个 `media_paths: ["/workspaces/task_1/output/gen_image.png"]` 给调度中心。

