# 🚀 專案部署 SOP（Next.js + PM2 + aaPanel + Cloudflare）

> 這份是通用的部署流程，適用於任何 Next.js 專案部署到 Oracle 伺服器（aaPanel + PM2 + Apache/Nginx）。
> 寫完一個專案要上線時，照這份做。改版本也照這份做。

---

## 目錄
1. [.gitignore — 不能上傳的檔案](#1-gitignore--不能上傳的檔案)
2. [第一次建置（新專案上線）](#2-第一次建置新專案上線)
3. [後續更新（改版本部署）](#3-後續更新改版本部署)
4. [常見問題排除](#4-常見問題排除)
5. [依賴與環境檢查清單](#5-依賴與環境檢查清單)


gitignore：

02-web/.next/
02-web/node_modules/
02-web/.env.local
*.env.local
.DS_Store
.gstack/
01-dev/use_proxycli/


---

## 1. .gitignore — 不能上傳的檔案

每個專案的根目錄放一個 `.gitignore`，**至少**要排除以下：

```gitignore
# Node.js
node_modules/
.next/
dist/
build/
out/

# 環境變數（含密鑰，絕不能上傳）
.env
.env.local
.env.*.local
*.env.local

# macOS / Windows 系統垃圾
.DS_Store
Thumbs.db

# 編輯器
.vscode/
.idea/
*.swp

# 日誌
*.log
npm-debug.log*
yarn-debug.log*

# Python（如果有 Python 子模組）
__pycache__/
*.pyc
*.pyo
venv/
.venv/

# 個人工具/實驗目錄
.gstack/
.claude/

# 專案內部敏感目錄（依專案需要新增）
01-dev/use_proxycli/   # 範例：API bridge 含密鑰
```

### ⚠️ 重要：絕對不能上傳的檔案類型

| 檔案 | 為什麼 |
|------|--------|
| `.env`、`.env.local` | 含 API key、DB 密碼、JWT secret |
| `id_rsa`、`*.pem`、`*.key` | SSH/SSL 私鑰 |
| `credentials.json`、`secrets.json` | 任何含密鑰的 JSON |
| `database.sqlite`、`*.db` | 資料庫檔案 |
| `node_modules/` | 太大且可重建 |
| `.next/`、`build/` | 編譯產物 |

### 如果不小心 commit 了敏感檔案

```bash
# 從 git 追蹤中移除（保留本機檔案）
git rm --cached <檔名>

# 加到 .gitignore
echo "<檔名>" >> .gitignore

# Commit 移除
git add .gitignore
git commit -m "chore: remove sensitive file from tracking"
git push

# ⚠️ 如果是密鑰，立刻去服務商後台 rotate（重新產生）
```

---

## 2. 第一次建置（新專案上線）

### A. 本機準備

```bash
# 1. 確認 .gitignore 完整（用上面那份）
cat .gitignore

# 2. 確認沒有敏感檔被追蹤
git ls-files | grep -E '\.env$|\.env\.local|key$|pem$|sqlite$'
# 上面這個指令應該完全沒有輸出

# 3. 確認最後 commit 都已 push
git status
git push
```

### B. Cloudflare DNS 設定

1. 登入 https://dash.cloudflare.com → 你的主域名
2. **DNS** → **新增記錄**
   - 類型：`A`
   - 名稱：子域名前綴（例如 `mentora`）
   - IPv4：`137.131.7.230`（Oracle 伺服器 IP）
   - **Proxy 狀態：灰色雲朵（DNS Only）** — 重要！
   - TTL：自動
3. 等 1-5 分鐘 DNS 生效，`ping <子域名>.looptw.com` 確認

### C. SSH 進伺服器初始化

```bash
ssh -i ~/Documents/important\ file/ssh-key-2026-04-08.key ubuntu@137.131.7.230
sudo su

# 安全：第一次 clone 前先設好 git ownership（避免之後 dubious ownership 錯誤）
git config --global --add safe.directory /www/wwwroot/<子域名>.looptw.com

# clone 專案
cd /www/wwwroot/
git clone https://github.com/<你的帳號>/<repo>.git <子域名>.looptw.com
cd <子域名>.looptw.com/02-web   # 或你的 Next.js 專案目錄

# 安裝依賴
npm install

# 建立 .env.local（重要！手動填入密鑰）
nano .env.local
# 貼上所有環境變數，例如：
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
# CLERK_SECRET_KEY=...
# DATABASE_URL=...
# 存檔離開

# 建置
npm run build

# 用 PM2 啟動（命名為 <專案名>-web）
pm2 start npm --name <專案名>-web -- start
pm2 save
pm2 startup   # 設定開機自啟（第一次要跑）
```

### D. aaPanel 設定 Nginx 反向代理

1. aaPanel 後台 → **網站** → **添加站點**
2. 填入：
   - 域名：`<子域名>.looptw.com`
   - 根目錄：`/www/wwwroot/<子域名>.looptw.com`
   - PHP：純靜態
3. 儲存後 → 點站點名 → **配置文件**
4. 在 `server` 區塊裡的 `location /` 加入反向代理：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;   # Next.js 預設 port
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # SSE 支援（如果用串流）
    proxy_buffering off;
    proxy_cache off;
}
```

> 如果同一台機器有多個 Next.js 專案，每個用不同 port（3000、3001、3002...），啟動時用 `PORT=3001 pm2 start...`

5. 儲存（沒紅字錯誤就是成功）
6. **SSL** → **Let's Encrypt** → 申請憑證 → 開啟「強制 HTTPS」

### E. 驗證

```bash
# 在伺服器上
curl -I http://127.0.0.1:3000     # 應該回 200
pm2 logs <專案名>-web --lines 20  # 看有沒有錯
```

打開瀏覽器訪問 `https://<子域名>.looptw.com`，看到網站就是成功。

---

## 3. 後續更新（改版本部署）

每次本機改完 code、push 到 git 之後，照下面流程部署到伺服器：

### 本機（先 push）

```bash
git add .
git commit -m "feat: 你的修改說明"
git push
```

### 伺服器（pull 並重新部署）

```bash
ssh -i ~/Documents/important\ file/ssh-key-2026-04-08.key ubuntu@137.131.7.230
sudo su

cd /www/wwwroot/<子域名>.looptw.com

# 拉新版本
git pull

# 進專案目錄
cd 02-web   # 或你的 Next.js 目錄

# 重新建置 + 重啟
npm install        # 如果有新增套件才需要，但跑也沒壞處
npm run build
pm2 restart <專案名>-web

# 看 log 確認啟動成功
pm2 logs <專案名>-web --lines 20
# 看到 ✓ Ready in ...ms 就是成功
# Ctrl+C 離開 logs
```

### ⚠️ `.env.local` 不會被 git pull 影響

`.env.local` 已經在 `.gitignore` 裡，**不會被覆蓋**。
但如果你**新增**了環境變數，要手動編輯伺服器上的檔案：

```bash
nano /www/wwwroot/<子域名>.looptw.com/02-web/.env.local
# 加上新變數
pm2 restart <專案名>-web   # 重啟才會讀新變數
```

---

## 4. 常見問題排除

### ❌ `fatal: detected dubious ownership in repository`

**原因：** root 操作非 root 擁有的 git repo。
**解法：**
```bash
git config --global --add safe.directory /www/wwwroot/<子域名>.looptw.com
```

### ❌ `error: Your local changes to the following files would be overwritten by merge`

**原因：** 伺服器上有檔案被本地 git 修改了（通常是 Python `.pyc`、`.next/` 等沒 ignore 的），擋住 pull。
**解法：**
```bash
# 安全做法：先看哪些檔案被改
git status

# 如果都是垃圾檔案（.pyc、build artifacts），直接丟掉
git checkout -- <檔案路徑>
# 或一次丟掉所有
git stash
git pull
git stash drop
```

### ❌ `npm run build` 失敗

```bash
# 看完整錯誤
npm run build 2>&1 | tail -30

# 如果是缺套件
npm install

# 如果是 TypeScript 錯誤，本機修好再 push
```

### ❌ PM2 重啟後 502 Bad Gateway

```bash
pm2 logs <專案名>-web --lines 50
# 看是不是啟動失敗

# 通常是 build 沒成功，重新跑
npm run build && pm2 restart <專案名>-web
```

### ❌ PM2 沒在跑這個專案

```bash
pm2 list
# 沒看到的話，重新啟動
cd /www/wwwroot/<子域名>.looptw.com/02-web
pm2 start npm --name <專案名>-web -- start
pm2 save
```

### ❌ 修改 code 後線上沒變化

可能原因（按機率排序）：
1. **`git pull` 沒成功** → 看 pull 的輸出有沒有 `Updating xxx..yyy`
2. **`npm run build` 失敗** → 跑完要看到 `✓ Compiled successfully`
3. **`pm2 restart` 沒跑** → `pm2 list` 看 `↺` 重啟次數有沒有增加
4. **瀏覽器快取** → 強制重新整理（Cmd+Shift+R）或無痕視窗

### ❌ Cloudflare 的 SSL 憑證錯誤

如果 DNS 設成橘色雲朵（Cloudflare Proxy），伺服器上的 SSL 必須是 **Cloudflare Origin Certificate**，不能用 Let's Encrypt。
反過來，灰色雲朵（DNS Only）配 Let's Encrypt。**不能混用**。

---

## 5. 依賴與環境檢查清單

### 伺服器必裝（一次性）

| 工具 | 安裝方式 | 用途 |
|------|---------|------|
| Node.js 20+ | aaPanel 軟體商店 / nvm | 跑 Next.js |
| PM2 | `npm install -g pm2` | Process manager |
| Git | `apt install git` | 拉 code |
| Nginx | aaPanel 預設 | 反向代理 |

### Next.js 專案必有

```
專案根目錄/
├── .gitignore           ← 必要
├── README.md            ← 寫怎麼跑
├── package.json
├── package-lock.json    ← 必要，鎖定版本
├── next.config.ts
├── tsconfig.json
├── .env.local.example   ← 環境變數範本（不含真實密鑰）
└── src/
    └── ...
```

### 每次新專案要做的事

- [ ] 建立 `.gitignore`（複製本文件第 1 節）
- [ ] 建立 `.env.local.example`（列出需要哪些環境變數，但值留空）
- [ ] `package.json` 的 `scripts` 有 `dev`、`build`、`start`
- [ ] `README.md` 寫清楚怎麼本機啟動
- [ ] Cloudflare 加 DNS 記錄
- [ ] 伺服器 clone + npm install + 建 `.env.local` + build + pm2 start
- [ ] aaPanel 站點設定 + Nginx 反向代理 + SSL

---

## 6. 一鍵部署腳本（選用）

把這個存成 `~/deploy-mentora.sh`（或任何專案名）：

```bash
#!/bin/bash
# Mentora 一鍵部署腳本
set -e   # 遇錯停止

PROJECT_DIR="/www/wwwroot/mentora.looptw.com"
APP_DIR="$PROJECT_DIR/02-web"
PM2_NAME="mentora-web"

cd "$PROJECT_DIR"
echo "📥 拉取最新 code..."
git pull

cd "$APP_DIR"
echo "📦 安裝依賴..."
npm install

echo "🔨 建置..."
npm run build

echo "🔄 重啟 PM2..."
pm2 restart "$PM2_NAME"

echo "✅ 完成！查看 log："
pm2 logs "$PM2_NAME" --lines 20 --nostream
```

執行：
```bash
chmod +x ~/deploy-mentora.sh
~/deploy-mentora.sh
```

之後每次部署只要打 `~/deploy-mentora.sh`。

---

## 📋 快速參考

### 日常更新部署（最常用）
```bash
# 本機
git add . && git commit -m "你的修改" && git push

# 伺服器
ssh -i ~/Documents/important\ file/ssh-key-2026-04-08.key ubuntu@137.131.7.230
sudo su
cd /www/wwwroot/<專案>.looptw.com && git pull && cd 02-web && npm run build && pm2 restart <專案>-web
```

### 看 log
```bash
pm2 logs <專案>-web --lines 30
```

### 重啟所有
```bash
pm2 restart all
```

### 緊急回滾上一版
```bash
cd /www/wwwroot/<專案>.looptw.com
git reset --hard HEAD~1
cd 02-web && npm run build && pm2 restart <專案>-web
```

---

**Last Updated:** 2026-04-10
**適用技術棧：** Next.js 16 + PM2 + Oracle ARM + Ubuntu 24.04 + aaPanel + Nginx + Cloudflare
