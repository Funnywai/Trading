# Trading AI — Multi-Agent Debate System

## 專案總覽

| 屬性 | 值 |
|------|-----|
| 介面 | Discord Bot (`discord.js` v14) |
| 語言 | TypeScript 5 (strict) |
| LLM | Deepseek API (`deepseek-v4-flash`) |
| 工作流引擎 | LangGraph (`@langchain/langgraph` v1.3.4) |
| 資料驗證 | Zod v4 |
| 持久化 | Prisma + SQLite (`prisma/dev.db`) |
| 測試框架 | Vitest v4 |
| 執行器 | `tsx` |
| 測試 | 157 tests / 19 files |
| 語言輸出 | 繁體中文（所有 Agent prompt 鎖定繁體中文輸出） |

## 目錄結構

```
Trading/
├── .env                          # DEEPSEEK_API_KEY, FINNHUB_API_KEY, DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID
├── prisma/
│   └── schema.prisma             # Portfolio, Holding, TradeRecord, RunHistory, AlertLog
│
└── src/
    ├── types/index.ts            # 所有共享 TS 型別
    ├── schemas/index.ts          # Zod schemas
    │
    ├── lib/
    │   ├── constants.ts          # RISK_FREE_RATE, DEEPSEEK_BASE_URL, MAX_RETRIES...
    │   ├── utils.ts              # mean, stdDev, percentile, calculateReturns...
    │   └── agent-runner.ts       # 共用 runAgent<T>() 工廠 (Zod validate + retry)
    │
    ├── db/
    │   ├── client.ts             # Prisma singleton
    │   └── portfolio-repo.ts     # getUserPortfolio(), saveUserPortfolio(), run history CRUD
    │
    ├── adapters/
    │   ├── llm/
    │   │   ├── interface.ts      # ILLMAdapter
    │   │   └── deepseek.ts       # Deepseek API 實作 (OpenAI-compatible)
    │   ├── market-data/
    │   │   ├── interface.ts      # IMarketDataAdapter
    │   │   └── yahoo-finance.ts  # Yahoo Finance: quote + history + fundamentals
    │   ├── news/
    │   │   ├── interface.ts      # INewsAdapter
    │   │   └── finnhub.ts        # Finnhub API (/company-news, 20 articles, 7 days)
    │   └── fundamental/
    │       ├── interface.ts      # IFundamentalAdapter
    │       └── fmp.ts            # FMP adapter (備用，目前 Yahoo 為主力)
    │
    ├── risk/
    │   ├── metrics.ts            # VaR95/99, CVaR, Sharpe, Sortino, MDD, Vol, Beta, Alpha, IR
    │   ├── concentration.ts      # single-stock, top3, sector, cluster risk
    │   ├── policy.ts             # position limits, stop-loss, BLOCK/CAUTION/ALLOW
    │   ├── enforcement.ts        # 11 條 deterministic decision enforcement rules
    │   ├── execution.ts          # slippage / fill simulation
    │   ├── alert-engine.ts       # 11 alert trigger rules
    │   ├── optimization.ts       # MVP, Max Sharpe, Efficient Frontier (experimental)
    │   ├── backtest.ts           # MA cross, momentum, mean reversion (experimental)
    │   └── pnl.ts                # P&L tracking
    │
    ├── agents/
    │   ├── main/                 # 主決策代理人
    │   │   ├── prompt.ts         # MAIN_THESIS_PROMPT (繁體中文)
    │   │   ├── schema.ts         # Zod schemas
    │   │   └── runner.ts         # runMainThesis(t=0.4)
    │   │
    │   ├── news/                 # 新聞分析代理人
    │   │   ├── prompt.ts         # NEWS_AGENT_PROMPT (繁體中文)
    │   │   ├── schema.ts         # Zod schemas
    │   │   └── runner.ts         # runNewsAgent(t=0.4)
    │   │
    │   ├── fundamental/          # 基本面分析代理人
    │   │   ├── prompt.ts         # FUNDAMENTAL_AGENT_PROMPT (繁體中文)
    │   │   ├── schema.ts         # Zod schemas
    │   │   └── runner.ts         # runFundamentalAgent(t=0.4)
    │   │
    │   ├── technical/            # 技術面分析代理人
    │   │   ├── prompt.ts         # TECHNICAL_AGENT_PROMPT (繁體中文)
    │   │   ├── schema.ts         # Zod schemas
    │   │   └── runner.ts         # runTechnicalAgent(t=0.4)
    │   │
    │   ├── sentiment/            # 情緒分析代理人 (讀原始新聞)
    │   │   ├── prompt.ts         # SENTIMENT_AGENT_PROMPT (繁體中文)
    │   │   ├── schema.ts         # Zod schemas
    │   │   └── runner.ts         # runSentimentAgent(t=0.4)
    │   │
    │   ├── macro/                # 宏觀分析代理人
    │   │   ├── prompt.ts         # MACRO_AGENT_PROMPT (繁體中文)
    │   │   ├── schema.ts         # Zod schemas
    │   │   └── runner.ts         # runMacroAgent(t=0.4)
    │   │
    │   ├── bull-researcher/      # 多方辯論代理人
    │   │   ├── prompt.ts         # BULL_RESEARCHER_PROMPT (繁體中文)
    │   │   ├── schema.ts         # Zod schemas
    │   │   └── runner.ts         # runBullResearcher(t=0.4)
    │   │
    │   ├── bear-researcher/      # 空方辯論代理人
    │   │   ├── prompt.ts         # BEAR_RESEARCHER_PROMPT (繁體中文)
    │   │   ├── schema.ts         # Zod schemas
    │   │   └── runner.ts         # runBearResearcher(t=0.4)
    │   │
    │   ├── research-manager/     # 研究整合代理人
    │   │   ├── prompt.ts         # RESEARCH_MANAGER_PROMPT (繁體中文)
    │   │   ├── schema.ts         # Zod schemas
    │   │   └── runner.ts         # runResearchManager(t=0.4)
    │   │
    │   ├── trader/               # 交易決策代理人
    │   │   ├── prompt.ts         # TRADER_PROMPT (繁體中文)
    │   │   ├── schema.ts         # Zod schemas
    │   │   └── runner.ts         # runTrader(t=0.4)
    │   │
    │   ├── risk/                 # 風險管理代理人 (只解讀，不計算)
    │   │   ├── prompt.ts         # RISK_AGENT_PROMPT (繁體中文)
    │   │   ├── schema.ts         # Zod schemas
    │   │   └── runner.ts         # runRiskAgent(t=0.3)
    │   │
    │   ├── verifier/             # 證據驗證代理人 (Evidence Gate)
    │   │   ├── prompt.ts         # VERIFIER_PROMPT (繁體中文)
    │   │   ├── schema.ts         # Zod schemas
    │   │   └── runner.ts         # runVerifierAgent(t=0.2)
    │   │
    │   ├── shared/               # (reserved)
    │   │
    │   └── debate/
    │       └── orchestrator.ts   # LangGraph StateGraph: 13 nodes + 8 routers (621 lines)
    │
    ├── bot/
    │   ├── index.ts              # Discord Bot 入口 (client, REST, slash + button interaction routing)
    │   ├── formatter.ts          # formatProgressEmbed(), formatResultEmbed()
    │   └── commands/
    │       ├── debate.ts         # debateCore() shared + handleDebate() + handleDebateFromButton()
    │       ├── portfolio.ts      # /portfolio show + /portfolio set slash commands
    │       └── search.ts         # /search news scanner + LLM scoring (30 stocks, 6 results)
    │
    └── __tests__/
        └── integration.test.ts   # Debate pipeline 整合測試
```

## 核心型別 (src/types/index.ts)

```typescript
type Direction = "BULLISH" | "BEARISH"
type DecisionAction = "ADD_SMALL" | "HOLD" | "REDUCE" | "EXIT" | "OBSERVE" | "NO_ACTION"
type EvidenceStrength = "WEAK" | "MODERATE" | "STRONG"
type DisagreementLevel = "LOW" | "MEDIUM" | "HIGH"

// 資料層
interface PriceBar { date, open, high, low, close, volume }
interface NewsArticle { headline, summary, source, url, publishedAt, sentiment? }
interface FundamentalData { ticker, peRatio, pbRatio, eps, revenueGrowth, profitMargin, debtToEquity, roe, currentRatio, marketCap, dividendYield }
interface MacroData { vix?, yield10y?, cpi?, unemployment?, fedFundsRate?, gdpGrowth? }
interface DataQuality { newsCount, missingFundamentalFields[], staleFlags[], qualityScore }

// Agent 層
interface Thesis { ticker, direction, thesis, confidence, keyPoints[] }
interface AgentArgument { agentId, agentName, position: "SUPPORT"|"OPPOSE"|"NEUTRAL", arguments[], evidence[], confidence }
interface DebateRound { round, thesis, arguments[], evidence[] }
interface EvidenceGateOutput { unsupportedClaims[], duplicatedEvidenceIds[], evidenceCoverageScore, canProceedToFinal, summary }
interface RiskAssessment { maxPositionSize, suggestedStopLoss, portfolioImpact, warnings[], riskScore }
interface RiskMetrics { var95, var99, cvar95, sharpeRatio, sortinoRatio, maxDrawdown, volatility, beta?, alpha?, informationRatio? }

// 決策層
interface FinalJudgment {
  ticker, action, conviction, rationale, debateSummary
  bullSummary[], bearSummary[], keyEvidenceIds[]
  evidenceStrength, disagreementLevel, dataQualityWarning[]
  entryPrice?, stopLoss?, positionSizePercent?
  invalidationConditions[], nextReviewTrigger
}

// 新 Agent 層
interface ResearchMemo { ticker, mergedThesis[], keyFindings[], unresolvedDivergence[], recommendation }
interface TradeProposal { ticker, side, entryBand?, stopLoss?, maxPositionSizePct?, rationale }
interface ApprovalDecision { action: "APPROVED"|"REJECTED"|"CONDITIONAL", rejectionReasons[], conditions? }
interface ExecutionSimResult { fillPrice, slippagePct, commission, executionResult }

// 結果層
interface DebateResult {
  ticker, currentPrice, thesis, rounds[], analystPassResults?
  riskAssessment?, riskMetrics?, executionSimResult?
  researchMemo?, tradeProposal?, approvalDecision?
  judgment, totalTokensUsed, durationMs
}
```

## Prisma Schema (prisma/schema.prisma)

```prisma
model Portfolio {
  id            String   @id @default(cuid())
  discordUserId String   @unique
  name          String
  cashBalance   Float    @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  holdings      Holding[]
}

model Holding {
  id          String    @id @default(cuid())
  portfolioId String
  ticker      String
  shares      Float
  averageCost Float
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  portfolio   Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
}

model TradeRecord {
  id             String   @id @default(cuid())
  ticker         String
  side           String
  action         String
  entryPrice     Float?
  stopLoss       Float?
  targetPrice    Float?
  positionSize   Float?
  status         String   @default("PROPOSED")
  approvalNotes  String?
  executedAt     DateTime?
  createdAt      DateTime @default(now())
}

model RunHistory {
  id               String   @id @default(cuid())
  ticker           String
  thesis           String
  researchMemo     String?
  tradeProposal    String?
  approvalDecision String?
  executionResult  String?
  alerts           String?
  notes            String?
  totalTokens      Int      @default(0)
  durationMs       Int      @default(0)
  createdAt        DateTime @default(now())
}

model AlertLog {
  id        String   @id @default(cuid())
  runId     String
  level     String
  category  String
  message   String
  dismissed Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

## LangGraph 工作流 (orchestrator.ts)

### 13 個 Node

```
START
  │
  ▼
┌──────────────────────────────────────────────────┐
│ 1. fetchData                                     │
│    Yahoo.getQuote + getHistoricalPrices          │
│    Finnhub.getNews(20)                           │
│    Yahoo.getFundamentalData (quoteSummary)       │
│    Yahoo.getMacroData (SPY, VIX, TLT, SHY ETFs)  │
│    → output: priceBars, news[], fundamentals,    │
│      macro, dataQuality                          │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 2. formThesis                                    │
│    runMainThesis(llm, { ticker, currentPrice,    │
│      fundamentalsSummary })                      │
│    → Thesis { direction, thesis, confidence }    │
│    error? → conservativeFinal                    │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 3. analystPass                                   │
│    Promise.all([                                 │
│      runNewsAgent, runFundamentalAgent,          │
│      runTechnicalAgent, runSentimentAgent,       │
│      runMacroAgent                               │
│    ])                                            │
│    error? → conservativeFinal                    │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 4. bullBearDebate (loopable, max 2 rounds)       │
│    Round 1: Bull-Researcher + Bear-Researcher    │
│             各自分析                              │
│    Round 2: 互相看到對方 R1 論點後反駁             │
│                                                │
│    動態提早結束:                                  │
│    ⏹ 共識達成 (信心 > 0.7) → early stop          │
│    ⏹ 無進展 (rounds ≥ 2 + 立場不變)               │
│                                                │
│    error? → conservativeFinal                    │
│    debateComplete? → researchManager              │
│    else → 🔁 loop bullBearDebate                  │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 5. researchManager                               │
│    runResearchManager(llm, { ticker, thesis,     │
│      bullArguments, bearArguments })              │
│    → ResearchMemo + TradeProposal                │
│    error? → conservativeFinal                    │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 6. verifierCheck                                 │
│    runVerifierAgent(llm, { ticker, thesis,       │
│      bullBearDebateRounds, dataQuality })         │
│    → EvidenceGateOutput                          │
│    error? → conservativeFinal                    │
│    qualityScore < 30? → conservativeFinal         │
│    !canProceedToFinal? → conservativeFinal        │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 7. computeRiskMetrics (hasPortfolio=true only)    │
│    computeAllRiskMetrics(priceBars)               │
│    computeConcentrationRisk(holdings)              │
│    → RiskMetrics (pure math, 0 LLM)              │
│    error? → conservativeFinal                    │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 8. assessRisk (hasPortfolio=true only)            │
│    runRiskAgent(llm, { ticker, thesis, portfolio │
│      riskMetrics })                              │
│    → RiskAssessment                              │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 9. trader                                        │
│    runTrader(llm, { ticker, thesis,              │
│      researchMemo, verifierReport,               │
│      riskAssessment?, riskMetrics?, portfolio? }) │
│    → FinalJudgment                               │
│    error? → conservativeFinal                    │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 10. approve                                      │
│     enforceDecisionPolicy(judgment, portfolio,   │
│       verifierReport) — 11 條 deterministic rules │
│     → ApprovalDecision + (action may be         │
│        downgraded, e.g. HOLD → OBSERVE)          │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 11. executionSim                                 │
│     simulateExecution(tradeProposal, currentPrice)│
│     generateAlerts(result)                       │
│     saveRunHistory(...)                          │
│     → ExecutionSimResult                         │
└──────────────────┬───────────────────────────────┘
                   ▼
                   END

┌──────────────────────────────────────────────────┐
│ conservativeFinal (fallback)                      │
│     0 LLM call, hardcoded OBSERVE                 │
│     Shows actual error cause in rationale        │
└──────────────────┬───────────────────────────────┘
                   ▼
                   END
```

### Router 邏輯

| Router | 條件 | 目標 |
|--------|------|------|
| `afterThesisRouter` | error? → conservativeFinal | else → analystPass |
| `afterAnalystRouter` | error? → conservativeFinal | no analysts passed? → conservativeFinal | else → bullBearDebate |
| `afterBullBearRouter` | error? → conservativeFinal | debateComplete? → researchManager | else → bullBearDebate (loop) |
| `afterResearchRouter` | error? → conservativeFinal | else → verifierCheck |
| `afterVerifierRouter` | error? → conservativeFinal | qualityScore < 30? → conservativeFinal | !canProceedToFinal? → conservativeFinal | hasPortfolio? → computeRiskMetrics | else → trader |
| `afterRiskRouter` | error? → conservativeFinal | else → assessRisk |
| `afterAssessRouter` | → trader |
| `afterTraderRouter` | error? → conservativeFinal | else → approve |

### Deepseek LLM 呼叫地圖

| Node | Agent | Calls | Temp | Model |
|------|-------|-------|------|-------|
| formThesis | Main-Thesis | 1 | 0.4 | v4-flash |
| analystPass | News | 1 | 0.4 | v4-flash |
| | Fundamental | 1 | 0.4 | v4-flash |
| | Technical | 1 | 0.4 | v4-flash |
| | Sentiment | 1 | 0.4 | v4-flash |
| | Macro | 1 | 0.4 | v4-flash |
| bullBearDebate | Bull-Researcher | 1-2* | 0.4 | v4-flash |
| | Bear-Researcher | 1-2* | 0.4 | v4-flash |
| researchManager | Research-Manager | 1 | 0.4 | v4-flash |
| verifierCheck | Verifier | 1 | 0.2 | v4-flash |
| assessRisk | Risk | 0-1** | 0.3 | v4-flash |
| trader | Trader | 1 | 0.4 | v4-flash |
| **Total** | | **9-13** calls | | |

\* 動態回合：共識達成或無進展時 Round 1 即停（節省 2 calls）
\*\* Risk Agent only if hasPortfolio=true

### 非 LLM Node

| Node | 做的事 |
|------|--------|
| fetchData | Yahoo/Finnhub API calls (non-LLM) |
| computeRiskMetrics | risk/metrics.ts + risk/concentration.ts pure math |
| approve | risk/enforcement.ts 11 條 deterministic rules |
| executionSim | risk/execution.ts slippage/fill + risk/alert-engine.ts |
| conservativeFinal | hardcoded `{ action: "OBSERVE", conviction: 0.1 }` |

## Risk Engine (src/risk/)

8 個純函數模組，**完全不依賴 LLM**：

| 模組 | 功能 |
|------|------|
| `metrics.ts` | VaR95/99, CVaR, Sharpe, Sortino, MDD, Vol, Beta, Alpha, IR |
| `concentration.ts` | single-stock, top3, sector, cluster risk |
| `policy.ts` | position limits, stop-loss, BLOCK/CAUTION/ALLOW |
| `enforcement.ts` | **11 條 deterministic rules** |
| `execution.ts` | slippage simulation, fill price calculation |
| `alert-engine.ts` | 11 alert trigger rules |
| `pnl.ts` | P&L tracking |
| `optimization.ts` | MVP, Max Sharpe, Efficient Frontier (experimental) |
| `backtest.ts` | MA cross, momentum, mean reversion (experimental) |

### enforceDecisionPolicy() 11 條規則

| # | 條件 | 效果 |
|---|------|------|
| 0 | 不持有但輸出 HOLD/REDUCE/EXIT | → OBSERVE（持倉感知） |
| 1 | qualityScore < 40 | → OBSERVE |
| 2 | verifier.canProceedToFinal = false | → OBSERVE |
| 3 | evidenceCoverageScore < 40 | → OBSERVE |
| 4 | evidenceStrength = WEAK + ADD_SMALL | → OBSERVE |
| 5 | riskScore >= 70 + ADD_SMALL | → HOLD |
| 6 | concentrationScore < 50 + ADD_SMALL | → HOLD |
| 7 | disagreementLevel = HIGH + ADD_SMALL | → HOLD |
| 8 | singleStockRisk.isConcentrated | cap positionSizePercent <= 5% |
| 9 | disagreementLevel = HIGH + ADD_SMALL/REDUCE | → HOLD |
| 10 | riskScore > 85 | → OBSERVE |

## Discord Bot

### Slash Commands

| 指令 | 功能 |
|------|------|
| `/debate <ticker>` | 啟動 13 節點多智能體分析 |
| `/debate <ticker> capital:100000 holdings:AAPL:50:180,...` | 手動指定 portfolio（覆蓋 DB） |
| `/search` | 掃描 30 檔重點股的新聞與報價，LLM 評分後回傳 Top 6 |
| `/search` → 點擊 `🚀 TICKER` 按鈕 | 直接啟動該標的完整辯論分析（含進度 + 結果 embed） |
| `/portfolio set capital:100000 holdings:AAPL:50:180,MSFT:30:350` | 儲存 portfolio 到 Prisma |
| `/portfolio set capital:100000` | 儲存純現金 portfolio（無持倉） |
| `/portfolio set capital:100000 holdings:-` | 同上，`-` 代表無持倉 |
| `/portfolio show` | 顯示已儲存的 portfolio |

### 流程

1. 首次: `/portfolio set capital:100000 holdings:AAPL:50:180`
2. 以後每次: `/debate AAPL` → 自動從 DB 讀取你的 portfolio → Risk Agent 啟用
3. 若 `/debate` 時同時提供 `capital` + `holdings` 參數 → 以參數為準（覆蓋 DB）
4. 掃描機會: `/search` → LLM 評分後點擊 `🚀 TICKER` 按鈕 → 直接啟動完整辯論分析（portfolio 僅從 DB 讀取）

### 進度顯示

- 每 **1 秒**更新一次 progress embed
- 保留最近 **15 行**進度記錄
- 分析結束後先 flush 最後進度，再顯示最終結果 embed
- 若 embed 內容過長導致 Discord 拒絕 → **fallback 純文字**顯示

### /search 流程

1. 並行抓取 30 檔掃描清單（`SCAN_UNIVERSE`）的報價 + 新聞（每檔限 3 篇）
2. 排除 0 新聞或抓取失敗的標的
3. 將剩餘標的以精簡格式送 LLM 評分（`temperature: 0.3, responseSchema: {}`）
4. LLM 回傳 JSON：`[{ ticker, score, rationale }]`，按分數降冪
5. 合併價格資料後顯示 Top 6 結果 embed
6. 每個結果附 `🚀 TICKER` 按鈕（Primary style），點擊後直接觸發 `debateCore()` 啟動完整辯論流程（含進度更新 + 結果 embed）

### Bot 啟動

```bash
npm run bot
```

## LLM Agent Runner 共用程式 (src/lib/agent-runner.ts)

```typescript
async function runAgent<T>(llm, config: {
  systemPrompt, inputSchema, outputSchema, input, agentName, temperature?
}): Promise<AgentRunResult<T>>
```

流程：
1. Zod `inputSchema.safeParse(input)` — 驗證輸入
2. `llm.chat([{ role: "system", content: prompt }, { role: "user", content: JSON.stringify(input) }])`
3. `JSON.parse(response.content)` — 嘗試解析 JSON
4. `outputSchema.safeParse(parsed)` — 驗證輸出
5. 若失敗 → 重試最多 `MAX_RETRIES` 次，每次重試時將驗證錯誤訊息傳回 LLM 要求修正
6. 返回 `{ success, data?, error?, tokensUsed, durationMs }`

## 硬護欄摘要 (Guardrails)

| 機制 | 位置 | 效果 |
|------|------|------|
| DecisionAction 限制 | Zod schema | 只有 6 種行動，不可輸出自由文字 |
| 持倉感知 (enforcement) | Rule 0 | 不持有但輸出 HOLD → 強制 OBSERVE |
| 證據捆綁規則 | Trader prompt | evidenceStrength < MODERATE → 不可 ADD_SMALL |
| Quality Gate | verifierCheck | qualityScore < 30 → conservativeFinal |
| Verifier Gate | verifierCheck | canProceedToFinal = false → conservativeFinal |
| Risk Gate | Rules 5, 10 | 高風險自動降級或封鎖 |
| Concentration Gate | Rules 6, 8 | 集中度過高 → 不可 ADD_SMALL, cap position |
| Dynamic Early Stop | bullBearDebate | 共識達成/無進展 → 跳過後續回合 |
| Schema Validation | agent-runner.ts | 每個 LLM 輸出必須通過 Zod；最多 2 次重試 |
| Risk/Calc 分離 | computeRiskMetrics (pure) vs assessRisk (LLM) | 量化計算不經 LLM |
| Conservative Fallback | conservativeFinalNode | 硬編碼 OBSERVE，0 LLM call |
| Embed Fallback | debate.ts handler | 結果過長 → 純文字顯示 |

## API Keys 設定 (.env)

```env
DEEPSEEK_API_KEY=sk-xxx
FINNHUB_API_KEY=xxx              # https://finnhub.io/register
DISCORD_BOT_TOKEN=xxx            # https://discord.com/developers/applications
DISCORD_CLIENT_ID=xxx            # Bot's Application ID
DATABASE_URL="file:./dev.db"     # Prisma SQLite
```

## 使用方式

```bash
# Discord Bot
npm run bot                      # 啟動 Bot，註冊 slash commands

# DB
npx prisma db push               # 同步 schema 到 SQLite
npx prisma generate               # 重新生成 Prisma client

# Tests
npm run test                     # 157 tests, 19 files
npm run typecheck                # tsc --noEmit
npm run lint                     # eslint
npm run test:watch               # vitest watch mode
```

## 驗證狀態

| 檢查 | 結果 |
|------|------|
| TypeScript | 0 錯誤 |
| Tests | 157 passed / 19 files |
| Dependencies | 363 packages (精簡後，261 個已移除) |

## Key Decisions

- **LangGraph over linear pipeline** — conditional routing, early stop, conservative fallback
- **Desk skeleton architecture** — split research/decision/control layers instead of single Main Agent
- **Evidence-gated actions** — Verifier + enforcement layer prevent LLM from making unsupported decisions
- **Size caps over action bans** — enforcement rules use position size constraints instead of hard OBSERVE blocks
- **Yahoo for fundamentals** — replaced FMP entirely (402/403 on free plan)
- **Discord Bot as separate process** — `tsx` runner, shares agent engine code, no HTTP hop
- **Portfolio in Prisma** — Discord User ID as key, no localStorage or JSON file
- **All agents use v4-flash** — 一致性與成本控制

## Known Limitations

1. **Avg duration ~133s** — bull/bear 2 rounds serial + v4-flash ~8s each
2. **Early stop threshold 0.7** — could be lowered to 0.65 to reduce duration
3. **concentration.ts sector map** — only 18 tickers hardcoded
4. **optimization.ts + backtest.ts** — experimental, not connected to main workflow
5. **No real-time price alerts** — only intra-run alert generation
6. **Button debate: portfolio from DB only** — 從 `/search` 按鈕觸發時無法自訂 `capital` / `holdings` 參數
