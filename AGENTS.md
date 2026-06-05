# Trading AI — Agent Guide

This is a **TypeScript Discord bot** using LangGraph for multi-agent stock analysis debates. **Not a web app** — no Next.js, no React.

## Entrypoints

| Command | What it runs |
|---------|-------------|
| `npm run bot` | Discord bot (`tsx src/bot/index.ts`) — slash commands `/debate`, `/portfolio` |
| `npm run test` | Vitest (all `src/**/*.test.ts`) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint 9 flat config |

There is no `npm run dev`. The README is stale about a web UI.

## Architecture

- **LangGraph StateGraph** with 13 nodes, 8 conditional routers (`src/agents/debate/orchestrator.ts`)
- **12 LLM agents** all use `deepseek-v4-flash` model via `DeepseekAdapter` (`src/adapters/llm/deepseek.ts`)
- **Risk engine** (`src/risk/`) is pure math — 0 LLM calls
- **Path alias**: `@/` → `./src/*` (configured in tsconfig.json + vitest.config.ts)
- **Zod v4** validation at every agent boundary via shared `runAgent<T>()` factory (`src/lib/agent-runner.ts`)
- **Prisma + SQLite** at `prisma/dev.db`
- All agent prompts output **Traditional Chinese** (繁體中文)

## Verification order

```bash
npm run lint && npm run typecheck && npm run test
```

## Key conventions

- Each agent has its own `prompt.ts`, `schema.ts`, `runner.ts` in `src/agents/<name>/`
- Agent runner retries on JSON parse failure or Zod validation failure (max 2 retries, 1s delay)
- Conservative fallback on any error: hardcoded `OBSERVE` at 0.1 conviction, 0 LLM calls
- Temperatures: verifier=0.2, risk=0.3, all others=0.4
- Tests are Vitest with `globals: true`, each file imports `describe, it, expect` from vitest explicitly

## DB commands

```bash
npx prisma db push          # Sync schema → SQLite (run after schema changes)
npx prisma studio            # Visual DB browser at localhost:5555
del prisma\dev.db            # Reset DB (stop dev server first)
```

## .env requirements

```
DEEPSEEK_API_KEY=sk-xxx
FINNHUB_API_KEY=xxx
DISCORD_BOT_TOKEN=xxx
DISCORD_CLIENT_ID=xxx
DATABASE_URL="file:./dev.db"
```

## Discord slash commands

- `/debate <ticker>` — run full 13-node analysis
- `/debate <ticker> capital:100000 holdings:AAPL:50:180,...` — override portfolio
- `/portfolio set capital:... holdings:...` — persist portfolio to DB
- `/portfolio show` — view saved portfolio
