# SESSION NOTES

## 2026-04-08（第四次工作階段）

### 今天完成的事

1. **品牌更名：Mentora**
   - 所有 UI 文字從 Life Mentor AI 改為 Mentora
   - 部署到 `mentora.looptw.com`

2. **圓桌群聊品質優化**
   - 發言順序隨機化（Fisher-Yates），不再固定富蘭克林先說
   - @用戶 提問後立刻停止，不等其他人
   - 偵測收緊：只認明確 @用戶 + 問號
   - 字數限制 40 字 / maxOutputTokens 60
   - 禁止元認知洩漏（「費曼已經問了所以我跳過」）
   - prompt 重構為 array.join 格式避免 Turbopack 解析錯誤

3. **導師語氣強化**
   - 三導師加口頭禪和互動特色（富蘭克林、費曼、斯多葛）
   - 自訂導師 analyze API 自動生成語氣/口頭禪/互動特色

4. **爭議歷史人物支援**
   - analyze API 重構為「教育平台角色設計師」框架
   - 自動加 ⚠️ 歷史警示區塊

5. **導師主動回顧（方案 B）**
   - 新增 getRecentContext() 查過去 3 天對話 + 未完成行動
   - 一般聊天和圓桌第一輪都注入，導師自然追問行動進展

6. **UX 改善**
   - 複製對話按鈕（一般聊天 + 圓桌都有）
   - 輸入法 composing 防誤送（ChatInput + RoundtableView）
   - 導師/理論分類分組（picker + header 下拉）
   - Admin 導師預覽加分類下拉選單
   - 圓桌關閉按鈕移除
   - @mention 用戶泡泡改白色避免顏色融合

7. **Bug 修復**
   - 圓桌插嘴後對話不存檔：改用 saveSession 函式 + SSE done 事件直接儲存
   - 並發 create session race condition：savingRef 鎖
   - clipboard 錯誤處理

8. **部署到 Oracle 伺服器**
   - Node.js 20 + PM2 + Python 3.11 安裝
   - proxycli venv + grpcio/protobuf
   - Apache 反向代理 → localhost:3000
   - PM2 開機自啟
   - 上線：mentora.looptw.com ✓

### 未完成的事
- Clerk 換 production key（目前用 test key）
- DATABASE_URL 密碼建議更換（已暴露在對話中）
- C0/C1 自用測試持續中
- 偏好學習（需 20+ 行動樣本累積）

### 下次從哪裡開始
- 測試 mentora.looptw.com 線上環境
- 圓桌群聊品質驗證（隨機排序 + @用戶即停 + 字數控制）
- 導師主動回顧效果測試
- Clerk production key 切換

### 伺服器管理
```bash
# SSH（需要 key）
ssh opc@144.24.11.24

# aaPanel
https://144.24.11.24:13582/990a2e2d

# PM2 管理
sudo su -
pm2 list          # 查看狀態
pm2 logs          # 查看日誌
pm2 restart all   # 重啟

# 更新部署
cd /www/wwwroot/mentora.looptw.com/02-web
git pull
npm run build
pm2 restart mentora-web
```

---

## 2026-04-08（第三次工作階段）

### 今天完成的事

1. **QA 安全修復**
   - `conversations PUT` 加 user 權限驗證（防越權修改）
   - `MessageBubble` + `summary` markdown 渲染加 `escapeHtml()` 防 XSS
   - Admin API 加角色權限控制（`ADMIN_USER_IDS` 環境變數）
   - 刪除死碼 `debate/route.ts` + `DebateView.tsx`（-537 行）

2. **圓桌群聊重構：多 Agent 獨立思考**
   - 每個導師獨立 AI 呼叫，短回應（1-3 句，maxTokens 120）
   - 導師互相 @mention 對話（@導師名、@用戶）
   - 最多 2 輪 6 turns，連續跳過自動停止
   - 前端 @mention 高亮顯示

3. **圓桌功能增強**
   - @用戶 tag：導師用 @用戶 向用戶提問
   - 插嘴功能：用戶可在導師討論中送訊息（AbortController 中斷串流）
   - 理論融合：prompt 改為鼓勵導師融合理論和自身思維
   - 圓桌可選擇特定理論加入討論

4. **分類系統**
   - DB 加 `category` 欄位（custom_personas + theories）
   - AI analyze 自動分類（管理學、心理學、哲學等）
   - Admin UI 顯示分類標籤
   - 內建導師加分類（franklin=管理學、feynman=科學、stoic=哲學）

5. **圓桌 @用戶 提問即停**
   - prompt 強化：絕對不要寫「用戶，...」，必須 @用戶
   - API 偵測 `@用戶` + `？` → 這輪立刻停止，不讓其他導師追加問題
   - prompt 告知其他導師：前面已有人提問就跳過

6. **@mention 下拉選單**
   - 輸入 `@` 彈出導師列表 + `@全部`
   - 打字過濾（`@費` → 只顯示費曼）
   - 點擊自動填入 `@名字 ` 到輸入框
   - `onMouseDown` + `preventDefault` 防 textarea 失焦

7. **QA 程式碼審查修復**
   - 插嘴 stale messages bug：改用 `messagesRef.current` 取最新值
   - 理論 picker 選中背景色無效 CSS 修復

### 未完成的事
- Enter/Shift+Enter 行為確認（程式碼已正確，待用戶驗證）
- C0/C1 自用測試持續中
- 偏好學習（需 20+ 行動樣本累積）

### 下次從哪裡開始
- 測試圓桌群聊新體驗（多 Agent 短對話 + 插嘴 + 理論選擇 + @用戶即停）
- 觀察導師是否正確使用 @用戶 和 @導師名
- 測試理論融合效果（加馬斯克導師 + 逆向思考法理論）
- 測試 @mention 下拉選單的 UX
- 根據體驗回饋微調 prompt 和 token 數

### 啟動方式
```bash
# 終端 1：Python Bridge
cd 01-dev/use_proxycli
python3.11 -m uvicorn server:app --host 127.0.0.1 --port 8765

# 終端 2：Next.js
cd 02-web
npm run dev
```

### 踩過的坑
- Headless browser (gstack browse) 跟 Clerk auth flow 不相容（登入後跳 about:blank）
- DB migration 需要在 02-web 目錄下跑 node（才能 require postgres）
- `postgres` tagged template 的 ALTER TABLE 不生效，要用 `sql.unsafe()` 才行

---

## 2026-04-07（第二次工作階段）

### 今天完成的事

1. **C0 Bug 修復**
   - Memory extraction 中文 prompt 修正（haiku 不再回英文）
   - Conversation 載入 race condition 修正（AbortController）
   - `maxTokens` → `maxOutputTokens`（AI SDK v6 全域修正）

2. **C1 圓桌群聊**
   - `/api/roundtable` — 多輪對話 API，SSE 串流
   - `RoundtableView` — 群聊 UI，@提及、回覆、主持人總結
   - `DebateMentorPicker` — 導師選擇彈窗
   - 理論融入（chat + roundtable 都注入 DB 理論）
   - 辯論記憶提取

3. **C1 行動追蹤**
   - `/api/actions` — CRUD API
   - `/actions` — 四欄看板（已接受/進行中/已完成/已拒絕）
   - `ActionSuggestion` — 導師回應中解析「【行動】」標記，顯示接受/拒絕卡片

4. **C1 每週成長摘要**
   - `/api/summary` — 分析 7 天對話+行動+記憶
   - `/summary` — 手動觸發摘要頁面

5. **對話紀錄系統重構**
   - 新 DB 表 `chat_sessions`（統一 chat + roundtable）
   - 多筆對話支援、刪除、圓桌標注
   - Sidebar 顯示導師名 + 圓桌標籤

6. **UI 重構（Gemini/ChatGPT 風格）**
   - 訊息居中 max-w-3xl，去氣泡
   - AI 回應 Markdown 渲染
   - Sidebar 可收合 + 對話歷史
   - 導師改 header 下拉選單
   - 輸入框居中大膠囊
   - 手機底部 Tab Bar
   - `+` 按鈕下拉：新對話 / 圓桌群聊

7. **QA Bug 修復**
   - 用戶訊息不顯示（parts/content 相容）
   - 圓桌 AI 無回應（streamText → generateText）
   - 圓桌歷史載入空白（加 DB 讀取 useEffect）
   - Sidebar 對話類型區分
