# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bandry is an Electron desktop application built with TypeScript, React, and Vite. It provides a local AI agent interface with sandboxed file operations and command execution.

## Development Commands

```bash
# Install dependencies (first time setup)
pnpm install

# If pnpm blocks postinstall scripts on first install
pnpm approve-builds

# Development (runs renderer, main process, and electron concurrently)
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## Architecture

### Process Architecture

The app follows Electron's multi-process architecture:

- **Main process** (`src/main/index.ts`): Electron main process, IPC handlers, service initialization
- **Renderer process** (`src/renderer/`): React UI running in browser context
- **Preload script** (`src/preload/index.ts`): Context bridge exposing IPC API to renderer

### Build System

- **Renderer**: Vite builds React app to `dist/`
- **Main + Preload**: tsup bundles to `dist-electron/*.cjs` (CommonJS for Node.js)
- Main entry point: `dist-electron/main.cjs`

### Domain Structure

Code is organized by domain (see `docs/code-organization.md`):

- `src/main/chat/`: Chat agent with planner-based tool calling (DeepSeek)
  - `deepseek-tool-chat-agent.ts`: Main chat agent with multi-step tool execution
  - `planner-parser.ts`: Parses planner JSON responses
  - `tool-executor.ts`: Executes planned tool calls
  - `prompt-builders.ts`: System prompts for planner and final response

- `src/main/config/`: Layered configuration system (project → user → env)
  - Loads from `.env`, user config, and project config
  - `load-config.ts`: Main entry point

- `src/main/models/`: LLM provider abstraction
  - `models-factory.ts`: Factory for generating text with different providers
  - Supports OpenAI, DeepSeek, and Volcengine

- `src/main/sandbox/`: Sandboxed file/command execution
  - `sandbox-service.ts`: Core sandbox operations (listDir, readFile, writeFile, exec)
  - `path-guard.ts`: Virtual path resolution and validation
  - Enforces allowlists for commands and workspaces

- `src/main/orchestrator/`: Task orchestration
  - `local-orchestrator.ts`: Plans and executes tool calls based on user prompts
  - Can run with or without LLM synthesis

- `src/shared/ipc.ts`: IPC type contracts between main and renderer
- `src/renderer/`: React UI components and hooks

### Key Patterns

**IPC Communication**: All main-renderer communication goes through typed IPC channels defined in `src/shared/ipc.ts`. The preload script exposes a safe `window.api` object.

**Chat Agent Flow**:
1. User sends message via `chat:send` IPC
2. `DeepSeekToolChatAgent` runs planner loop (max 10 steps)
3. Planner decides to use tools or answer directly
4. Tools execute via `SandboxService`
5. Final response synthesized from observations
6. Progress updates broadcast via `chat:update` events

**Sandbox Security**:
- All file paths go through virtual path resolution
- Commands must be in allowlist
- Output size and execution time limits enforced
- Audit logging for all operations

**Configuration Layers**: Config merges in order: defaults → project config → user config → environment variables. Provider API keys typically come from `.env`.

## Environment Setup

Create `.env` file with:
```
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_MODEL=deepseek-chat  # optional, defaults to deepseek-chat
```

## Testing

- Test files: `src/**/*.test.ts`
- Test environment: Node.js (vitest)
- Run single test: `pnpm test <file-pattern>`

## Code Style

- ESLint config in `eslint.config.js`
- Renderer code: React hooks rules enforced
- Main/preload: Strict `no-explicit-any` rule
- TypeScript strict mode enabled
