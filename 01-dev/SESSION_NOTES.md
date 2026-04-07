# SESSION NOTES

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

### 未完成的事
- 偏好學習（需 20+ 行動樣本累積）
- C0/C1 自用測試 1 週驗證

### 下次從哪裡開始
- 開始自用測試，每天至少 1 次對話
- 觀察記憶提取品質（haiku 是否正確提取繁體中文）
- 測試行動追蹤完整流程（接受→進行中→完成）
- 1 週後產生第一份每週摘要
- 根據自用回饋決定是否進入 C2

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
- AI SDK v6 用 `maxOutputTokens` 不是 `maxTokens`
- `streamText` 的 `textStream`（for await）在 Python bridge 上不穩定，圓桌改用 `generateText`
- React 18 Strict Mode 會 double-invoke useEffect，用 useRef 鎖防止重複
- DB 載入的訊息格式可能沒有 `parts`（舊格式用 `content`），需要 fallback
- `chat_sessions` 表取代舊的 `conversations` 表（`(user_id, mentor_id)` 主鍵不支援多筆對話）
