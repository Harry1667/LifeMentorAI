# 修復：mentora 與 mathbox 內容混在一起

## 問題描述

訪問 `https://mathbox.looptw.com` 時，會看到 **mentora 的 Clerk 登入頁**，而不是 mathbox 自己的內容。

## 診斷結果

| 檢查項目 | mentora.looptw.com | mathbox.looptw.com |
|---------|-------------------|-------------------|
| DNS 解析 | Cloudflare Proxy (104.21.50.63) | 直連 Oracle (137.131.7.230) |
| HTTP 結果 | 正常（Clerk 登入頁） | aaPanel「網站已停止」 |
| HTTPS 結果 | 正常 | **顯示 mentora 的內容（錯誤）** |
| Nginx conf | `mentora.looptw.com.conf` 存在 | **不存在** |

## 根本原因

**`mathbox.looptw.com.conf` 不存在。** 伺服器上只有 mentora、survivalwallet、zhijian 三個站點的 Nginx 設定。

當 HTTPS 請求帶著 `Host: mathbox.looptw.com` 進來時：
1. Nginx 找不到 mathbox 的 server block
2. fallback 到 mentora（唯一監聽 443 + SSL 的 vhost）
3. Next.js 不分域名，回傳 mentora 的頁面

---

## 修復步驟

### 步驟 1：aaPanel 後台建立 mathbox 站點

1. 登入 aaPanel 後台
2. **網站** → **添加站點**
3. 填入：
   - 域名：`mathbox.looptw.com`
   - 根目錄：`/www/wwwroot/mathbox.looptw.com/02-web`
   - PHP 版本：**純靜態**（mathbox 是 Node ESM，不需要 PHP）
4. 點「提交」

### 步驟 2：申請 SSL 憑證

1. 在 aaPanel → **網站** → 點 `mathbox.looptw.com` → **SSL**
2. 選 **Let's Encrypt** → 申請
3. 開啟「強制 HTTPS」

> 前提：mathbox.looptw.com 的 DNS A 記錄已指向 137.131.7.230（灰色雲朵）

### 步驟 3：修改 Nginx 設定

在 aaPanel → **網站** → 點 `mathbox.looptw.com` → **配置文件**

找到預設的 `location /` 區塊，替換為以下內容（轉發到 PM2 的 port 3001）：

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

點「儲存」，確認沒有紅色報錯。

### 步驟 4：確認 PM2 有跑 mathbox

```bash
pm2 list
```

確認有 `mathbox-web` 在 port 3001 運行中。如果沒有：

```bash
cd /www/wwwroot/mathbox.looptw.com/02-web
PORT=3001 pm2 start server.mjs --name mathbox-web
pm2 save
```

### 步驟 5：驗證修復

在本機終端執行：

```bash
# 確認 mathbox HTTPS 不再回傳 mentora 內容
curl -sI https://mathbox.looptw.com | head -5

# 確認 mentora 正常
curl -sI https://mentora.looptw.com | head -5
```

---

## Cloudflare 狀態備忘（已確認，不需修改）

| 域名 | Cloudflare 模式 | SSL 類型 |
|------|----------------|---------|
| mentora.looptw.com | 橘色雲朵（Proxy） | Cloudflare Origin Cert |
| mathbox.looptw.com | 灰色雲朵（DNS Only） | Let's Encrypt |
| survivalwallet.looptw.com | 灰色雲朵（DNS Only） | Let's Encrypt |

> `0-run.md` 已更新為正確的 Cloudflare 狀態。
