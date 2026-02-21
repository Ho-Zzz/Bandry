# Bandry 配置架构（重构版）

## 目标

基于 `docs/blue-print.md`，统一“配置读取入口、分层规则、目录约定”，解决 `.env` 与 `src/main/config` 混用导致的行为不透明问题。

## 单一入口

所有主进程配置统一由 `loadAppConfig()` 生成，其他模块只读 `AppConfig`：

- `src/main/index.ts`
- `src/main/sandbox/sandbox-service.ts`
- `src/main/openviking/process-manager.ts`

禁止在业务模块直接读取 `process.env`。

## 分层规则

固定优先级（低 -> 高）：

1. `default`（代码内默认值）
2. `project`（项目配置）
3. `user`（用户配置）
4. `env`（`.env` + 进程环境变量）

同层兼容策略：

- Project：先读 legacy，再读推荐路径（推荐路径覆盖 legacy）
- User：先读 legacy，再读推荐路径（推荐路径覆盖 legacy）

## 路径设计（对齐 blue-print）

默认以 `~/.bandry` 为根目录：

- `~/.bandry/config/`：用户配置与数据库
- `~/.bandry/logs/`：审计日志
- `~/.bandry/workspaces/`：任务工作区
- `~/.bandry/resources/`：记忆资源
- `~/.bandry/plugins/`：插件目录
- `~/.bandry/traces/`：轨迹日志

项目层配置推荐路径：

- `<project>/.bandry/config.json`

兼容旧路径：

- `<project>/config.json`
- `~/.config/bandry/config.json`

## 环境变量职责划分

- 业务配置：`LLM_*`、`SANDBOX_*`、`OPENVIKING_*`、`OPENAI_*`、`DEEPSEEK_*`、`VOLCENGINE_*`
- 路径覆盖：`BANDRY_*`（如 `BANDRY_HOME`、`BANDRY_WORKSPACES_DIR`）
- 启动辅助：`VITE_DEV_SERVER_URL`（进入 `config.runtime`）

## 运行时环境统一

`AppConfig.runtime` 统一承载子进程所需环境：

- `devServerUrl`
- `inheritedEnv`

这样 sandbox / OpenViking 子进程不再自行访问 `process.env`。

## 迁移说明

旧配置无需立刻迁移，系统会自动兼容读取旧路径。建议逐步迁移到：

- `<project>/.bandry/config.json`
- `~/.bandry/config/config.json`
