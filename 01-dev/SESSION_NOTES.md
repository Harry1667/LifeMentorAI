# SESSION NOTES

## 2026-04-10（第六次工作階段）

### 今天完成的事

1. **Nginx vhost 問題診斷**
   - 發現 https://mathbox.looptw.com 顯示 mentora 內容
   - 根因：mathbox 沒有 Nginx vhost，HTTPS 請求 fallback 到 mentora
   - 寫了 `01-dev/FIX-nginx-vhost.md` 完整修復步驟
   - 更新 `01-dev/0-run.md` 標註 mentora=橘色雲朵 / mathbox=灰色雲朵

2. **PWA 支援**
   - `src/app/manifest.ts` — Web App Manifest（深色主題、standalone）
   - `public/icons/` — 4 個圖示尺寸（從 favicon 生成）
   - `public/sw.js` — Service Worker（cache-first 靜態、network-first 頁面、不快取 API）
   - `ServiceWorkerRegister.tsx` — SW 註冊元件
   - `layout.tsx` 加入 viewport（theme-color、safe-area、apple-web-app meta）
   - `globals.css` 加入 standalone 模式樣式（safe area、防拖曳但保留對話可選取）

3. **gitignore 清理**
   - 加入 `01-dev/use_proxycli/`
   - `git rm -r --cached` 移除追蹤

4. **圓桌討論架構大改 — 兩輪辯論制**
   - 第一輪：所有導師各自表態（嚴禁向用戶提問）
   - 第二輪：隨機 2 人辯論回應，最後結辯者 @用戶 提問
   - `MAX_DEBATERS_ROUND2 = 2`，總共 4-5 次 AI 呼叫
   - prompt 強調用 @導師名 反駁/融合其他觀點

5. **三項 bug 修復**
   - 插嘴後殘留空對話框：abort 後過濾 content 為空的 mentor messages
   - @用戶 必須等回覆：所有導師統一規則 + UI 顯示「導師們在等你的回覆」
   - 理論不出現：沒選不載入全部、prompt 從「可以」改「必須」、token 300→600

6. **後端強制截掉用戶提問**
   - prompt 擋不住 AI 在第一輪問用戶問題
   - `stripTrailingUserQuestion()` 遞迴從尾部截掉問句段落
   - 只留陳述句結尾，問問題權留給第二輪結辯者

7. **導師/理論詳情彈窗**
   - `DetailModal.tsx`（MentorDetailModal + TheoryDetailModal）
   - 三處可查看：圓桌選人 picker（hover）、圓桌頂部頭像（點擊）、一般聊天下拉選單（hover）

8. **persona 框架升級** ⭐
   - 參考 awesome-persona-distill-skills 架構
   - 從 300 字性格描述 → 800-1200 字認知操作系統
   - 重寫三個內建導師（Franklin/Feynman/Stoic）
   - 6 區塊架構：身份定位 / 心智模型 / 決策啟發法 / 表達 DNA / 內在矛盾 / 已知局限
   - 新增 `PERSONA_FRAMEWORK.md`、`_template.ts`
   - admin 表單 label 加提示

9. **chat route 大修 — streamText 改 generateText** 🔥
   - 發現 `streamText` 在 proxy bridge 上完全卡死（直接測試證實連一個 chunk 都沒輸出）
   - 不只 `for await`，連 `toUIMessageStreamResponse()` 也壞掉
   - 改用 `generateText + createUIMessageStream`，手動寫 `text-start/delta/end` chunks
   - `feedback_streaming.md` 記憶已更新（從「streamText 不穩定」升級為「streamText 完全不能用」）

10. **圓桌人數限制 + 後端強制 @用戶**
    - `MAX_SPEAKERS_ROUND1 = 3`（之前用戶選 9 個導師結果第一輪跑了 9 個）
    - 第二輪優先選沒在第一輪講過的人
    - 結辯者沒問 @用戶 時，後端強制再呼叫一次 AI 補一個追問訊息
    - `stripTrailingUserQuestion` 改按單一 \n 切行（之前 \n\n+ 切段對單行回應失效）

11. **停止按鈕**
    - `ChatInput` 加 `onStop` prop，loading 時送出鈕變紅色停止鈕
    - chat page 接 `useChat` 的 `stop()`
    - `RoundtableView` 加停止按鈕（abort + 清空 + 儲存）

12. **詳情彈窗顯示完整 system prompt**
    - `DetailModal` 從顯示摘要改為顯示**完整 system prompt** 內容
    - 加複製按鈕
    - 理論 modal 顯示 `systemPromptExtension`
    - admin 後台導師/理論卡片可點擊查看詳情
    - 模態框寬度從 max-w-md 改為 max-w-2xl

13. **部署到生產環境** ✅
    - 解決 git dubious ownership（`safe.directory` 設定）
    - 解決 .pyc 檔案 merge conflict（`git checkout --` 丟掉）
    - mentora.looptw.com 已上線最新版
    - PM2 重啟次數從 1 → 2，新版本確認啟動

14. **新增通用部署 SOP 文檔** 📘
    - `01-dev/DEPLOY-SOP.md` — 6 區塊完整部署流程
    - .gitignore 範本、第一次建置、後續更新、常見問題、依賴清單、一鍵腳本
    - 可帶到其他專案直接複用

15. **清理 .DS_Store git 追蹤**
    - `git rm --cached .DS_Store 02-web/.DS_Store`

### 未完成的事
- mathbox.looptw.com Nginx vhost 還沒在伺服器上修（FIX-nginx-vhost.md 已刪，內容見 git history）
- Clerk production key 切換
- Controller already closed bug（用戶 abort 時的 race condition，error log 偶爾出現）
- 線上測試新版本對話品質（兩輪辯論 + 後端強制 @用戶 + 新 persona 框架）

### 下次從哪裡開始
- 線上測試 https://mentora.looptw.com 新版本
- 觀察兩輪辯論制 + 強制 @用戶 是否真的擋住對話一直跑
- 如果用戶反映 abort 時 server log 仍有 controller closed 錯誤，加 try-catch 保護
- 考慮新增更多導師（孔子、愛因斯坦、賈伯斯、馬斯克等已自訂的）按 PERSONA_FRAMEWORK.md 撰寫
- 觀察兩輪辯論制 + 新 persona prompt 的對話品質
- 考慮新增更多導師（孔子、愛因斯坦、賈伯斯、馬斯克等），按 PERSONA_FRAMEWORK.md 撰寫

---

## 2026-04-09（第五次工作階段）

### 今天完成的事

1. **側邊欄即時刷新**
   - 一般對話：送出訊息時並行建立 session，不阻塞 AI 請求
   - 圓桌群聊：加 `onSessionCreated` callback，建立/更新後都刷新側邊欄
   - AI 回完後 fallback 保護（session creation 比 AI 慢時補建）

2. **ESLint 全面修復（0 errors 0 warnings）**
   - React 19 ref-during-render 違規修正（useEffect 包裝）
   - 移除未使用變數（showMenu, mentorMap, currentMessages）
   - `chat/route.ts` optional chaining 修復（防止 `.parts` undefined crash）

3. **時區統一 Asia/Taipei**
   - 側邊欄日期分組（今天/昨天判斷改用台灣時區字串比較）
   - 行動追蹤、週摘要、近期上下文日期顯示

4. **圓桌群聊重寫**
   - 移除硬性輪次/字數限制，導師獨立思考自由發揮
   - 2 人發言後提示可以問用戶，@用戶 提問後全停
   - maxOutputTokens 60→300，讓回答有深度
   - 移除「導演 AI」預排劇本的方案，保持每人自主

### 未完成的事
- aaPanel 壞掉，尚未重新部署 mentora.looptw.com
- Clerk 換 production key（目前用 test key）
- DATABASE_URL 密碼建議更換
- 圓桌對話品質持續調整中

### 下次從哪裡開始
- 修好 aaPanel 後重新部署
- 測試圓桌新版對話品質（自然度、互動深度）
- 根據 9-talk.md 的測試反饋繼續微調 prompt

---

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
