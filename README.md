# Trading AI — Multi-Agent Debate System

**Version:** 0.2.0

美股多代理人辯論分析系統。使用 Deepseek API + LangGraph，由 12 個專業 Agent 組成完整 trading desk 工作流。

## 快速開始

```bash
npm install
```

### 設定 API Keys

編輯 `.env`：

```env
DEEPSEEK_API_KEY=sk-xxx
FINNHUB_API_KEY=xxx
```

### 啟動 Web 介面

```bash
npm run dev
```

打開 [http://localhost:3000](http://localhost:3000)，輸入美股 ticker（如 AAPL、TSLA），點擊「開始辯論」。

---

## 命令總覽

| 命令 | 說明 |
|------|------|
| `npm run dev` | 啟動 Next.js 開發伺服器 |
| `npm run build` | Production build |
| `npm run test` | 執行所有測試 (157 tests / 19 files) |
| `npm run typecheck` | TypeScript 型別檢查 |
| `npm run lint` | ESLint 檢查 |

---

## 資料庫 (Prisma + SQLite)

系統使用 SQLite 儲存每次分析的完整歷史記錄（RunHistory table），無需安裝額外資料庫。

### 初始化資料庫

```bash
# 產生 Prisma Client + 推送到 SQLite
npx prisma db push
```

### 查看歷史記錄

```bash
# 開啟 Prisma Studio 視覺化瀏覽資料
npx prisma studio
```

打開 `http://localhost:5555` 查看所有 run history、alerts、approval records。

### 重設資料庫

```bash
# 刪除現有資料庫
del prisma\dev.db

# 重新建立
npx prisma db push
```

### 在 Prisma Schema 修改後更新

```bash
# 先停掉 dev server（避免 file lock）
# 然後：
npx prisma db push --accept-data-loss
# 重啟 dev server 後會自動 npx prisma generate
```

---

## 專案結構

```
src/
├── agents/          # 12 個 LLM Agent (Main, News, Fundamental, Technical, Sentiment, Macro, Bull/Bear Researcher, Research Manager, Trader, Risk, Verifier)
├── debate/          # LangGraph StateGraph 工作流 (orchestrator.ts)
├── risk/            # 純函數風險引擎 (metrics, concentration, policy, enforcement, execution, alert-engine, pnl)
├── adapters/        # 外部 API (Deepseek, Yahoo Finance, Finnhub)
├── db/              # Prisma SQLite (RunHistory, Portfolio)
├── app/             # Next.js Web UI + API routes
├── types/           # TypeScript 型別
└── schemas/         # Zod validation
```

## 完整文件

詳細架構、Agent Prompt、工作流圖 → [PROJECT-REFERENCE.md](./PROJECT-REFERENCE.md)
