<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:deployment-context -->
## 部署環境

- **Bot 運行位置**：遠端 Linux 伺服器（Debian），透過 SSH 連線操作
- **連線工具**：WinSCP（Windows 端傳檔）、Windows Terminal + SSH
- **Node.js**：需 v22+（目前 Linux 上可能還在 v18，需升級）
- **Prisma**：使用 SQLite，`.env` 中 `DATABASE_URL="file:./dev.db"`，需手動在 Linux 上準備 `.env` 檔
- **持續運行**：使用 `tmux`（`tmux new -s bot` → `npm run bot` → `Ctrl+B, D` 脫離）
- **重新連線**：`tmux attach -t bot`
- **跨平台注意**：Windows 開發 → Git push → Linux 上 `git pull` 後需執行 `npx prisma generate`（binary target 為 `debian-openssl-3.0.x`）
- **首次部署**：需在 Linux 上執行 `npx prisma db push` 建立 SQLite 資料庫
<!-- END:deployment-context -->
