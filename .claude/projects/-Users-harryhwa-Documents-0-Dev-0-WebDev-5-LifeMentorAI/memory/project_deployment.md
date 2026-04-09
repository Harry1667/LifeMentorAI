---
name: Mentora 部署資訊
description: mentora.looptw.com 部署在 Oracle ARM 伺服器，aaPanel + Apache + PM2
type: project
---

Mentora 已部署到 mentora.looptw.com（Oracle Cloud ARM aarch64）

**Why:** 從本地開發進入線上測試階段
**How to apply:** 更新部署時需要 SSH 或 aaPanel，用 git pull + npm run build + pm2 restart

伺服器：
- IP: 144.24.11.24
- aaPanel port: 13582
- 網站目錄: /www/wwwroot/mentora.looptw.com/
- Web server: Apache（不是 Nginx）
- PM2 管理 mentora-web（Next.js :3000）和 mentora-bridge（Python :8765）
- opc 帳號有 NOPASSWD sudo（/etc/sudoers.d/opc）
