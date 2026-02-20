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

## Environment

LLM provider settings live in `.env`.

For chat prototype, DeepSeek is used by default in backend IPC (`chat:send`).
Required keys in `.env`:

- `DEEPSEEK_API_KEY`
- Optional: `DEEPSEEK_MODEL` (defaults to `deepseek-chat` if empty)
