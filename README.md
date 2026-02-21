# Bandry

Local desktop AI assistant (`Electron + Node.js + TypeScript + React + Vite`).

## Prerequisites

- Node.js 22+
- pnpm 10+

## Development

```bash
pnpm install
pnpm dev
```

If pnpm blocks postinstall scripts on first install, run:

```bash
pnpm approve-builds
```

## Build

```bash
pnpm build
```

## Test

```bash
pnpm test
```

## Configuration

Runtime config is loaded by `src/main/config` with a single precedence chain:

`default -> project config -> user config -> .env / process env`

### Config files

- Project config (recommended): `.bandry/config.json`
- Project config (legacy, still supported): `config.json`
- User config (recommended): `~/.bandry/config/config.json`
- User config (legacy, still supported): `~/.config/bandry/config.json`

### Environment

- `.env` is loaded from project root by default.
- Override dotenv file path with `BANDRY_DOTENV_PATH`.
- Common provider keys: `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `VOLCENGINE_API_KEY` (or `BYTEDANCE_API_KEY`).
- Runtime paths can be overridden with `BANDRY_*` variables (for example `BANDRY_HOME`, `BANDRY_WORKSPACES_DIR`, `BANDRY_DB_PATH`).
