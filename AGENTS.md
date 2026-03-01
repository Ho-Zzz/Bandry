# AGENTS.md

Guidelines for AI agents working in the Bandry codebase.

## Commands

```bash
# Install dependencies (first time setup)
pnpm install

# If pnpm blocks postinstall scripts
pnpm approve-builds

# Development (runs renderer, main, and electron concurrently)
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Run single test file
pnpm test <file-pattern>  # e.g., pnpm test src/main/sandbox/tests/sandbox-service.test.ts

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

## Project Structure

Electron multi-process app:
- **Main process** (`src/main/`): Node.js backend, IPC handlers, services
- **Renderer process** (`src/renderer/`): React UI (browser context)
- **Preload script** (`src/preload/`): Context bridge exposing safe API
- **Shared** (`src/shared/`): IPC type contracts

### Domain Organization

- `src/main/orchestration/`: Chat planning + workflow orchestration (local + DAG workers)
- `src/main/llm/`: Model runtime, providers, and model catalog
- `src/main/memory/`: OpenViking integration, extraction, and layered memory
- `src/main/automation/`: Trigger engine and task state machine
- `src/main/mcp/`: MCP registry and adapters
- `src/main/persistence/sqlite/`: SQLite stores and schema
- `src/main/config/`: Layered configuration (project → user → env)
- `src/main/sandbox/`: Sandboxed file/command execution with path guarding
- `src/main/channels/`: External messaging channels (Feishu/Lark), ChannelManager, command parsing
- `src/main/settings/`: Global settings and model onboarding services

## Code Style

### TypeScript

- Strict mode enabled (`strict: true`)
- Target: ES2022, Module: ESNext
- No explicit `any` in main/preload code (enforced by ESLint)
- Use `type` imports: `import type { Foo } from "./foo"`

### Naming Conventions

- Files: kebab-case (`chat-agent.ts`, `use-chat-session.ts`)
- Classes: PascalCase (`DeepSeekToolChatAgent`)
- Functions/variables: camelCase (`sendMessage`, `sandboxService`)
- Constants: UPPER_SNAKE_CASE (`MAX_TOOL_STEPS`)
- React components: PascalCase (`ChatInterface`)
- Custom hooks: camelCase starting with `use` (`useChatSession`)
- Types/Interfaces: PascalCase (`ChatSendInput`, `ToolObservation`)

### Imports

Order: external libs → shared types → sibling modules → relative imports

```typescript
import { useState } from "react";                          // external
import type { ChatSendInput } from "../../shared/ipc";    // shared types
import type { SandboxService } from "../sandbox";         // sibling domain
import { MAX_TOOL_STEPS } from "./chat-constants";        // relative
```

### Error Handling

- Use custom error classes extending `Error`
- Include context in error details
- Example: `SandboxViolationError` with `code` and `details` properties

### React Patterns

- Functional components with hooks
- Custom hooks for complex logic (see `use-chat-session.ts`)
- React hooks rules enforced by ESLint in renderer code
- `react-refresh/only-export-components` rule enabled

## Testing

- Framework: Vitest
- Test files: `src/**/tests/**/*.test.ts` (module-local `tests/` directories only)
- Environment: Node.js
- Use `vi.fn()` for mocks
- Run single test: `pnpm test <pattern>`

## Key Patterns

**IPC Communication**: All main-renderer communication through typed IPC channels in `src/shared/ipc.ts`. Preload exposes `window.api` object.

**Chat Agent Flow**: User message → planner loop (max 10 steps) → tool execution → final response synthesis. Progress updates via `chat:update` events.

**Sandbox Security**: Virtual path resolution → allowlist checks → execution limits → audit logging.

**Configuration Layers**: defaults → project config → user config → env vars. API keys from `.env`.

## Environment Setup

Create `.env`:
```
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_MODEL=deepseek-chat  # optional

# Channel integration (optional)
CHANNELS_ENABLED=false
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_ALLOWED_CHAT_IDS=chat_id_1,chat_id_2  # optional whitelist
```
