# TODO: Hermes Agent 整合計劃

> 架構：保留現有 TypeScript trading engine（13-node LangGraph orchestrator + Verifier gate + risk enforcement + Prisma persistence），透過 Service Layer → HTTP API → Hermes 的多層封裝，讓 Hermes 負責 tools、memory、cron 和多平台入口。

---

## 架構總覽

```
                      ┌─────────────────────────────┐
                      │     Hermes Agent (Python)    │
                      │  ┌─────────┐  ┌──────────┐  │
  Telegram / Slack ───▶│  │ Gateway │  │  Cron    │  │
                      │  └────┬────┘  └────┬─────┘  │
                      │       │            │         │
                      │  ┌────▼────────────▼─────┐  │
                      │  │    Tool Registry      │  │
                      │  │  (call HTTP / MCP)    │  │
                      │  └──────────┬───────────┘  │
                      └─────────────┼──────────────┘
                                    │ HTTP localhost:3400
                      ┌─────────────▼──────────────┐
                      │   Trading Engine (TS)       │
                      │  ┌──────────────────────┐   │
                      │  │  Express API Server   │   │
                      │  │  POST /trade/buy      │   │
                      │  │  POST /trade/sell     │   │
                      │  │  GET  /pnl/:uid       │   │
                      │  │  POST /review/:uid    │   │
                      │  │  POST /debate/run     │   │
                      │  │  GET  /portfolio/:uid │   │
                      │  │  PUT  /portfolio/:uid │   │
                      │  │  GET  /history/:uid   │   │
                      │  │  POST /digest/:uid    │   │
                      │  │  GET  /search/:uid    │   │
                      │  └──────────┬───────────┘   │
                      │  ┌──────────▼───────────┐   │
                      │  │  Application Services │   │
                      │  │  tradeService()       │   │
                      │  │  pnlService()         │   │
                      │  │  reviewService()      │   │
                      │  │  debateService()      │   │
                      │  │  portfolioService()   │   │
                      │  │  historyService()     │   │
                      │  │  digestService()      │   │
                      │  │  searchService()      │   │
                      │  └──────────┬───────────┘   │
                      │  ┌──────────▼───────────┐   │
                      │  │  Existing Core        │   │
                      │  │  orchestrator.ts      │   │
                      │  │  risk/*.ts             │   │
                      │  │  db/portfolio-repo.ts  │   │
                      │  │  agents/**/runner.ts   │   │
                      │  └──────────────────────┘   │
                      └─────────────────────────────┘
```

---

## 關鍵架構決策

| 決策 | 選擇 | 原因 |
|------|------|------|
| Bridge | HTTP API (REST) | 語言無關、易測試、Hermes 可用 terminal + curl 或 MCP 呼叫 |
| User Identity | `discordUserId` → `userId` | 最少改動，rename column + 改 TypeScript code |
| Discord Bot | 保留不動 | 零風險，現有用戶不受影響，Hermes 是純增量 |

---

## Phase 1：抽 Service Layer

### 目標
從 `bot/commands/debate.ts` 抽出純業務邏輯，放進 `src/application/`，不破壞現有 Discord bot。

### Prisma Schema 微調

```prisma
model Portfolio {
  id            String        @id @default(cuid())
  userId        String        @unique       // 原 discordUserId，rename
  platform      String        @default("discord")  // 新增，預設 discord
  name          String
  totalCapital  Float         @default(0)   // 初始投入總本金（固定不變）
  cashBalance   Float         @default(0)   // 實際現金餘額（隨買賣增減）
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  holdings      Holding[]
  closedTrades  ClosedTrade[]
}

model ClosedTrade {
  id          String   @id @default(cuid())
  portfolioId String
  ticker      String
  side        String            // "BUY" | "SELL"
  shares      Float
  price       Float
  totalValue  Float
  realizedPnl Float?            // 僅 SELL 有值
  createdAt   DateTime @default(now())
  portfolio   Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
}
```

Migration: `ALTER TABLE Portfolio RENAME COLUMN discordUserId TO userId;`
Migration: 新增 `totalCapital` 欄位；舊資料首次讀取時自動遷移（`totalCapital=0` 觸發）

### 新增檔案

```
src/application/
├── trade-service.ts        # buyStock(userId, ticker, shares, price?), sellStock(userId, ticker, shares, price?)
├── pnl-service.ts          # getPnlSummary(userId) → { totalAsset, cash, realizedPnl, unrealizedPnl, totalPnl, winRate, holdings[] }
├── review-service.ts       # runPortfolioReview(userId) → ReviewReport（逐持倉 debate 結果）
├── debate-service.ts       # runDebateForUser(ticker, userId, options?) → DebateResult
├── portfolio-service.ts    # getPortfolioSummary(userId), setPortfolio(userId, capital, holdings?),
│                           #   addHolding(userId, ticker, shares, price), removeHolding(userId, ticker, shares, price)
├── history-service.ts      # getRecentRuns(userId, limit), getRunDetail(runId)
├── digest-service.ts       # generateDailyDigest(userId) → DigestPayload
├── search-service.ts       # scanMarket(userId) → ScanResult (from search.ts)
└── index.ts                # barrel export
```

### 修改檔案

- `src/bot/commands/trade.ts` — 改 call `tradeService().buyStock() / sellStock()`
- `src/bot/commands/pnl.ts` — 改 call `pnlService().getPnlSummary()`
- `src/bot/commands/review.ts` — 改 call `reviewService().runPortfolioReview()`
- `src/bot/commands/portfolio.ts` — 改 call `portfolioService()`（含 trading operations）
- `src/bot/commands/debate.ts` — 改 call `debateService()` 而非直接 `new DeepseekAdapter()` + `runDebate()`
- `src/bot/commands/search.ts` — 改 call `searchService()`
- `src/bot/commands/help.ts` — 可從 service 層動態產生指令說明（選項，非必要）
- `src/db/portfolio-repo.ts` — 所有 `discordUserId` 改為 `userId`

### 硬護欄：完全不碰
- `src/agents/debate/orchestrator.ts`
- `src/risk/enforcement.ts` (11 條規則)
- `src/agents/**/runner.ts`
- `src/agents/**/prompt.ts`
- `src/risk/metrics.ts`, `concentration.ts`

---

## Phase 2：建立 Express API Server

### 目標
把 service layer 暴露成 HTTP endpoints，讓任何外部系統（包括 Hermes）可呼叫。

### 新增檔案

```
src/api/
├── server.ts              # Express app, listen on localhost:3400
├── routes/
│   ├── trade.ts           # POST /api/trade/buy, POST /api/trade/sell
│   ├── pnl.ts             # GET  /api/pnl/:userId
│   ├── review.ts          # POST /api/review/:userId
│   ├── debate.ts          # POST /api/debate/run
│   ├── portfolio.ts       # GET/PUT /api/portfolio/:userId
│   ├── history.ts         # GET /api/history/:userId?limit=10
│   ├── digest.ts          # POST /api/digest/:userId
│   └── search.ts          # GET /api/search/:userId
├── middleware/
│   └── auth.ts            # API key middleware (X-API-Key header)
└── index.ts               # 啟動入口
```

### API Endpoints（全部 Zod validated）

| Method | Endpoint | Request Body | Response |
|--------|----------|-------------|----------|
| `POST` | `/api/trade/buy` | `{ userId, ticker, shares, price? }` | `{ success, cashAfter, costBasis }` |
| `POST` | `/api/trade/sell` | `{ userId, ticker, shares, price? }` | `{ success, realizedPnl, cashAfter }` |
| `GET` | `/api/pnl/:userId` | - | `{ totalAsset, totalCapital, cash, realizedPnl, unrealizedPnl, totalPnl, winRate, holdings[] }` |
| `POST` | `/api/review/:userId` | - | `ReviewReport`（逐持倉分析結果） |
| `POST` | `/api/debate/run` | `{ userId, ticker, capital?, holdings? }` | `DebateResult` |
| `GET` | `/api/portfolio/:userId` | - | `{ totalCapital, cashBalance, holdings[] }` |
| `PUT` | `/api/portfolio/:userId` | `{ capital, holdings[] }` | `{ success }` |
| `GET` | `/api/history/:userId?limit=5` | - | `RunSummary[]` |
| `POST` | `/api/digest/:userId` | - | `DigestPayload` |
| `GET` | `/api/search/:userId` | - | `SearchResult[]` |

### 啟動
```json
// package.json 新增
"api": "tsx src/api/index.ts"
```

### 注意
- Express 需手動設置（npm install express @types/express）
- 或使用 Hono / Fastify（更輕量）
- API server 只 listen `localhost`，不對外暴露

---

## Phase 3：Hermes Tool Registry

### 目標
讓 Hermes 可以 call trading engine 的 API。

### 方案：MCP Server

在 `src/integrations/hermes/` 實作 MCP server，Hermes 原生支援 MCP 自動發掘工具。

```
src/integrations/hermes/
├── mcp-server.ts          # MCP server (使用 @modelcontextprotocol/sdk)
├── tools.ts               # Tool definitions: run_debate, get_portfolio, etc.
├── handlers.ts            # Tool handlers → call application services
├── types.ts               # Hermes tool input/output Zod schemas
└── __tests__/
    └── mcp-server.test.ts
```

### Tool Definitions (8-10 tools)

| Tool Name | Description | Input |
|-----------|-------------|-------|
| `buy_stock` | 買入股票（扣現金、加倉、記錄交易） | `{ userId, ticker, shares, price? }` |
| `sell_stock` | 賣出股票（加現金、減倉、記錄已實現損益） | `{ userId, ticker, shares, price? }` |
| `get_pnl` | 查詢投資組合損益摘要（含勝率） | `{ userId }` |
| `review_portfolio` | 對所有持倉逐一執行辯論分析 | `{ userId }` |
| `run_debate` | 執行 13-node 多智能體辯論分析（含 verifier + risk + enforcement） | `{ userId, ticker }` |
| `get_portfolio` | 查詢用戶投資組合摘要 | `{ userId }` |
| `get_run_history` | 查詢最近辯論分析紀錄 | `{ userId, limit? }` |
| `generate_daily_digest` | 生成每日摘要（持倉 + 分析 + 警示） | `{ userId }` |
| `scan_market` | 全市場新聞掃描 + LLM 評分 | `{ userId }` |

### 備案：Shell Wrapper（如果 MCP 太複雜）

```
~/.hermes/skills/trading/
├── SKILL.md               # Skill 描述，告訴 Hermes 如何 call API
└── scripts/
    ├── buy_stock.sh       # curl -X POST http://localhost:3400/api/trade/buy ...
    ├── sell_stock.sh      # curl -X POST http://localhost:3400/api/trade/sell ...
    ├── get_pnl.sh         # curl http://localhost:3400/api/pnl/$1
    ├── run_debate.sh      # curl -X POST http://localhost:3400/api/debate/run ...
    ├── get_portfolio.sh   # curl http://localhost:3400/api/portfolio/$1
    └── get_digest.sh      # curl -X POST http://localhost:3400/api/digest/$1
```

---

## Phase 4：Hermes Cron 設定

### 目標
利用 Hermes 的 scheduled tasks 跑定時工作。

### 排程建議

```bash
# 每天早上 8:30 生成持倉摘要（含現金水位提醒）
hermes cron create "30 8 * * 1-5" \
  "Call generate_daily_digest for the user, summarize in Chinese, and send to me."

# 每週五 16:30 收盤後生成 P&L 週報（含勝率、已實現損益、最佳/最差標的）
hermes cron create "30 16 * * 5" \
  "Call get_pnl for the user, compare with last week's snapshot, highlight changes in win rate and top/bottom performers."

# 每週一早上 9:00 做整週風險回顧
hermes cron create "0 9 * * 1" \
  "Call get_portfolio, check concentration risk, alert if high. Also call get_pnl to flag any drawdown > 5%."

# 每 4 小時掃描 watchlist（Phase 5 實作 watchlist 後）
# hermes cron create "every 4h" "Call scan_market and report unusual activity."
```

---

## Phase 5：Memory Mapping

### 目標
讓 Hermes 記住用戶偏好、近期行為模式、交易風格。

### 實作方式
在 `generate_daily_digest` 的回傳中附帶 `UserContext`：

```typescript
interface UserContext {
  userId: string
  preferences: {
    riskTolerance: "conservative" | "moderate" | "aggressive"
    favoriteTickers: string[]
    lastActivePlatform: string
  }
  recentPatterns: {
    frequentlyBlockedByVerifier: boolean
    avgConviction: number
    mostCommonAction: string
  }
  stats: {
    winRate: number
    totalRealizedPnl: number
    totalTrades: number
    avgConviction: number
    totalUnrealizedPnl: number
  }
  portfolioAge: number
}
```

Hermes 透過 memory 層（Honcho / session search）將此 context 注入每次對話的 system prompt。

### 注意
- 第一版保持 **read-only**，不反寫主資料表
- 後續可考慮接 Honcho、Mem0 等 external memory provider
- DeepSeek 共用：現有 LLM adapter 已支援 DeepSeek，Hermes 也可沿用同一供應商

---

## Phase 6：多平台入口

### 目標
Hermes 的 gateway 支援 Telegram、Slack、WhatsApp、Signal 等，啟用後即可多平台接入。

### 步驟
1. `hermes gateway setup` — 設定 Telegram bot token
2. `hermes gateway start` — 啟動 gateway
3. Hermes 自動將 /debate /portfolio 等指令透過 tools 轉發到 trading engine

### 注意
- Discord 保留現有 bot 不做改動（現有用戶不受影響）
- Hermes 的 Discord gateway 先不啟用（避免衝突）
- Telegram 先上，Slack 後續

---

## 各 Phase 實施順序與時間估算

| Phase | 工作 | 天數 | 依賴 |
|-------|------|------|------|
| **1** | Prisma migration + Service Layer | 3-5 天 | 無 |
| **1** | Discord bot 改 call services | 1 天 | Phase 1 services |
| **2** | Express API Server | 2-3 天 | Phase 1 services |
| **3** | MCP Server / Shell Wrappers | 2-3 天 | Phase 2 API |
| **4** | Hermes Cron 設定 | 1-2 天 | Phase 3 tools |
| **5** | Memory Mapping (UserContext) | 1-2 天 | Phase 1 digest-service |
| **6** | 多平台 Gateway | 2-3 天 | Phase 3 tools 穩定 |

**總計：約 4-5 週（並行可壓縮至 3 週）**

---

## 補充：交叉比對後發現的缺口

| 缺口 | 嚴重度 | 說明 |
|------|--------|------|
| API request/response Zod schemas 未定義 | 🔴 高 | `schemas/index.ts` 只有 Agent schema，Phase 2 endpoint 的 input/output 需新增定義 |
| `resolveTradePrice()` 未納入 service 藍圖 | 🟡 中 | `trade.ts` 買賣前會自動抓 Yahoo 即時報價補 `price`，此邏輯需內建在 `trade-service.ts` |
| `parseHoldings()` 重複存在兩處 | 🟡 中 | `debate.ts:27` 和 `portfolio.ts:29` 有相同的 holdings 字串解析函數，抽 service 時應合併到 `src/lib/` |
| API error response 格式未定義 | 🟡 中 | Phase 2 需定義統一格式 `{ success: false, error: { code, message } }` |
| `.env` 新增變數未列舉 | 🟡 中 | Phase 2 需 `API_PORT`、`API_KEY`；Phase 4 需 `MORNING_SCAN_CHANNEL_ID` |
| MCP vs Shell Wrapper 未決策 | 🔴 高 | 建議 Shell Wrapper MVP 先上，MCP 後續升級 |
| `"all"` share 語意處理 | 🟢 低 | `/sell shares:all` 解析存在於 Discord handler，API 層需明確規範 |

---

## 前置工作：Plan B 晨間掃描 Cron（✅ 已完成）

> 在 Hermes Phase 1-4 完成前，先在 TypeScript 端用 `node-cron` 實作每天早上自動執行 `/search` 並輸出到 Discord 指定頻道。

**已建檔案：**
- `src/application/search-service.ts` — 從 `bot/commands/search.ts` 抽出核心邏輯（`scanMarket(onProgress)` pure function）
- `src/application/index.ts` — barrel export
- `src/bot/commands/search.ts` — 改為薄包裝，呼叫 `scanMarket()`
- `src/bot/index.ts` — `client.once("ready")` 時註冊 cron job（`30 8 * * 1-5`）
- `.env` — 新增 `MORNING_SCAN_CHANNEL_ID`

> 此實作正好也是 Hermes Phase 1 的 `search-service.ts` 第一步，未來掛上 Express endpoint 即可，零浪費。

---

## 不碰的部分（硬護欄）

| 模組 | 原因 |
|------|------|
| `src/agents/debate/orchestrator.ts` | 13-node LangGraph 核心，零改動 |
| `src/risk/enforcement.ts` | 11 條確定性決策強制規則 |
| `src/agents/**/runner.ts` | Agent runner 邏輯 |
| `src/agents/**/prompt.ts` | 繁體中文 prompt |
| `src/risk/metrics.ts` | 純數學計算 |
| `src/risk/concentration.ts` | 集中度風險 |
| `src/risk/alert-engine.ts` | 警示觸發 |
| `src/lib/agent-runner.ts` | 共用 runAgent<T>() |

---

## 安全規則

- **Hermes 不得做最終交易判斷** — 所有 action 必須經過 verifierCheck → assessRisk → approve → executionSim
- **所有 Hermes tool input/output 用 Zod 驗證**
- **API server 只 listen localhost**，不對外暴露
- **API key middleware** 確保只有 Hermes 可呼叫
- **Hermes cron 執行時不允許遞迴建立更多 cron jobs**（Hermes 內建保護）
