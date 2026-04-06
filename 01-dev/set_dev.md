# Life Mentor AI — 開發現狀總覽

> 最後更新：2026-04-06

---

## 產品定位

**核心概念**：越用越了解你的 AI 導師系統。記憶累積是護城河——用了 6 個月的 Life Mentor AI 比 ChatGPT 更有價值，因為它記得你的偏好、決定、困境。

**目標用戶（切入點）**：台灣大學生，尤其是實習中遇到職場困境的學生。  
**創辦人即用戶**：自己是目標用戶，最強的需求驗證。

**三個核心功能（優先順序）**：
1. 長期記憶（系統記得你是誰）
2. 多導師視角（不同觀點碰撞）
3. 行動追蹤（建議執行情況）

---

## 開發階段

| 階段 | 名稱 | 範圍 | 狀態 |
|------|------|------|------|
| C0 | 聊天 + 記憶原型 | 3 導師 × 1 對話 + 記憶儲存 | **已完成** ✓ |
| C1 | 多導師辯論 | 串行辯論 → Synthesizer + 行動追蹤 | 待開發 |
| C2 | RAG | 向量搜尋記憶（條件觸發） | 待評估 |

**C0 完成門檻**（已達到）：能正常對話 + 記憶能寫入讀出 + 部署可訪問

---

## 技術棧（實際採用）

| 類別 | 技術 | 說明 |
|------|------|------|
| 框架 | Next.js 16.2.2 (App Router) | Turbopack，Tailwind v4 |
| 身份驗證 | Clerk v7 | `auth()` server-side 取 userId |
| AI 接入 | twloop AI Proxy（gRPC） | `cli.twloop.com:443`，透過 Python bridge |
| AI SDK | `ai` v6 + `@ai-sdk/openai` | `useChat`、`streamText`、`DefaultChatTransport` |
| 資料庫 | PostgreSQL（aaPanel 自架） | `57.182.129.192:5432`，`postgres.js` 直連 |
| 部署 | 本機開發中 | 尚未上 Vercel/生產 |

---

## 服務架構

```
瀏覽器
  │  useChat（@ai-sdk/react）
  ▼
Next.js :3000
  │  /api/chat  POST
  ▼
Python Bridge :8765  （01-dev/use_proxycli/server.py）
  │  gRPC  cli.twloop.com:443
  ▼
twloop AI Proxy  →  Anthropic Claude
```

### 為什麼需要 Python Bridge

twloop proxy 是 gRPC Python 客戶端，Node.js 無法直接呼叫。  
Bridge 暴露 OpenAI 相容格式（`POST /v1/chat/completions` + SSE 串流），  
讓 AI SDK 的 `createOpenAI` 直接接。

---

## 專案目錄結構

```
5-LifeMentorAI/
├── 01-dev/
│   ├── 1-PRD.md                     完整 PRD（詳細設計文件）
│   ├── set_dev.md                   本文件（開發現狀總覽）
│   └── use_proxycli/
│       ├── proxy.py                 AI Proxy gRPC 客戶端（v2.1.0）
│       ├── server.py                Python Bridge（FastAPI OpenAI-compatible）
│       ├── .env                     Proxy Token + Project 設定
│       ├── requirements.txt         fastapi, uvicorn, grpcio, protobuf
│       └── aiproxy_pb2*.py          gRPC 生成文件
│
└── 02-web/                          Next.js 16 App
    ├── src/
    │   ├── app/
    │   │   ├── api/chat/route.ts    POST handler（streamText v6）
    │   │   ├── chat/page.tsx        主對話頁面
    │   │   ├── sign-in/[[...]]/     Clerk 登入
    │   │   ├── sign-up/[[...]]/     Clerk 註冊
    │   │   ├── layout.tsx           ClerkProvider
    │   │   ├── page.tsx             redirect → /chat
    │   │   └── globals.css          設計系統 CSS 變數
    │   ├── components/
    │   │   ├── MentorSidebar.tsx    桌面左側欄 + 手機底部 Tab
    │   │   ├── MessageBubble.tsx    訊息氣泡 + TypingBubble
    │   │   ├── ChatInput.tsx        自動調整高度輸入框
    │   │   └── ActionCard.tsx       快速行動卡片
    │   ├── lib/
    │   │   ├── ai-proxy.ts          createOpenAI → localhost:8765
    │   │   ├── memory-extraction.ts 記憶提取（第二個 AI 呼叫）
    │   │   ├── personas/            富蘭克林、費曼、斯多葛人格
    │   │   ├── supabase/
    │   │   │   ├── client.ts        postgres.js 查詢（getUserMemories / saveMemories）
    │   │   │   └── schema.sql       建表 SQL（需手動在 aaPanel 執行）
    │   │   └── types/               Memory、Persona TypeScript 型別
    │   └── proxy.ts                 Clerk 路由保護（Next.js 16 convention）
    ├── .env.local                   環境變數（不 commit）
    └── .env.local.example           範本
```

---

## 環境變數

### `02-web/.env.local`

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/chat
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/chat

# PostgreSQL (aaPanel)
DATABASE_URL=postgresql://lifementoraI:...@57.182.129.192:5432/lifementoraI

# AI 由本機 Python bridge 提供，不需要 ANTHROPIC_API_KEY
```

### `01-dev/use_proxycli/.env`

```env
AI_PROXY_HOST=cli.twloop.com
AI_PROXY_PORT=443
AI_PROXY_TLS=true
AI_PROXY_TOKEN=...
AI_PROXY_PROJECT=agent-lifementor
AI_PROXY_GROUP=chat
AI_PROXY_PROVIDER=claude
AI_PROXY_CLAUDE_MODEL=claude-sonnet-4-6
```

---

## 啟動方式（本機開發）

```bash
# 終端 1：啟動 Python AI Bridge
cd 01-dev/use_proxycli
nohup python3.11 -m uvicorn server:app --host 127.0.0.1 --port 8765 > /tmp/ai-bridge.log 2>&1 &

# 確認橋接層正常
curl http://127.0.0.1:8765/health  # → {"status":"ok"}

# 終端 2：啟動 Next.js
cd 02-web
npm run dev  # → http://localhost:3000
```

**注意**：Python Bridge 需要 Python 3.10+（proxy.py 用了 `X | Y` union type）。  
Mac 上用 `python3.11`（`brew install python@3.11`）。

---

## 資料庫（需手動建表）

在 aaPanel PostgreSQL 執行 `02-web/src/lib/supabase/schema.sql`：

```sql
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content JSONB NOT NULL,
  importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memories_user_importance
  ON memories(user_id, importance DESC, updated_at DESC);
```

---

## 核心設計決策（已定案）

### 記憶系統

- **提取機制**：每次對話結束（`onFinish`）後，非同步發起第二個 AI 呼叫（claude-haiku）提取記憶
- **重要性評分**：`importance INTEGER 1-10`，影響召回優先順序
  - 10：核心價值觀 / 長期人格特質
  - 8：長期偏好（不喜歡某種方式）
  - 5：具體決定（決定用番茄鐘）
  - 3：短暫情緒 / 一次性話題
- **召回策略**：`ORDER BY importance DESC, updated_at DESC LIMIT 20`
- **Memory type（discriminated union）**：`topic` / `decision` / `preference` / `milestone`

### 安全原則

- `userId` 永遠只從 `auth()` 取得，不接受 request body 傳入
- Python Bridge 只綁 `127.0.0.1`，不對外暴露

### AI SDK v6 重點

- `useChat` 從 `@ai-sdk/react` 引入（不是 `ai/react`）
- 傳輸用 `DefaultChatTransport({ body: () => ({ mentor }) })`
- `streamText` 用 `maxOutputTokens`（不是 `maxTokens`）
- route 回傳 `toUIMessageStreamResponse()`（不是 `toDataStreamResponse()`）
- messages 需要 `await convertToModelMessages(messages)` 轉換

---

## 設計系統

```css
--bg-primary:      #1a1814   /* 主背景，深棕黑 */
--bg-chat:         #13100d   /* 聊天區背景 */
--bg-bubble-mentor:#252017   /* 導師訊息氣泡 */
--bg-sidebar:      #131109   /* 側欄背景 */
--text-primary:    #e8e4df   /* 主文字 */
--text-secondary:  #9ca3af   /* 次要文字 */
--accent-gold:     #d97706   /* 品牌金色 */
--mentor-franklin: #2563eb   /* 富蘭克林藍 */
--mentor-feynman:  #16a34a   /* 費曼綠 */
--mentor-stoic:    #71717a   /* 斯多葛灰 */
```

- 字型：Georgia / Noto Serif TC（沉穩、書卷氣）
- 導師識別：字母徽章（F / R / M），圓形，各自代表色
- 訊息排版：導師訊息靠左，用戶訊息靠右（金色背景）
- 手機：底部 Tab Bar 取代側欄

---

## C1 設計（待開發）

### 串行辯論機制

```
用戶輸入
  → 富蘭克林（務實建議）
  → 費曼（追問深層原因）
  → 斯多葛（情緒視角）
  → Synthesizer（統整三個觀點）
```

**重點**：串行而非並行，每個導師都能看到前一個導師的觀點，形成真正的辯論。

**部分失敗處理**：已完成的步驟正常顯示，失敗的步驟顯示淡色錯誤提示，不阻塞整個流程。

### 行動追蹤

```sql
CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  advice_text TEXT NOT NULL,
  status TEXT DEFAULT 'accepted',  -- accepted | in_progress | rejected | completed
  progress_pct INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 下一步待辦

### 立即（C0 收尾）

- [ ] **建表**：在 aaPanel PostgreSQL 執行 `schema.sql`
- [ ] **測試完整流程**：登入 → 對話 → 確認記憶寫入 DB → 重新對話確認記憶被注入
- [ ] **Rate limiting**：API route 加速率限制（P1，避免 token 被濫用）
- [ ] **Error monitoring**：加 Sentry 或簡單的 error log（P2）

### C0 驗證門檻（全部通過才算完成）

- [ ] 三個導師都能正常對話
- [ ] 記憶能正確寫入 DB（查 memories 表）
- [ ] 重新整理後，導師能在回應中自然引用過去記憶
- [ ] 手機版底部 Tab Bar 正常切換導師
- [ ] 未登入被正確導向 /sign-in

### C1 開始前

- [ ] C0 至少自用 2 週，收集真實痛點
- [ ] 確認記憶提取品質（haiku 提取的記憶是否有用）
- [ ] 評估是否需要記憶 deduplication（同一個偏好被重複記）

### C1 實作項目

- [ ] 串行辯論 API route（`/api/debate`）
- [ ] Synthesizer 導師人格
- [ ] 辯論 UI（四個訊息串連顯示）
- [ ] 行動追蹤 DB + UI
- [ ] actions table 建立

---

## 已知問題 / 技術債

| 問題 | 嚴重程度 | 說明 |
|------|----------|------|
| 記憶無 deduplication | 中 | 同一偏好可能被多次提取儲存 |
| Bridge 重啟需手動 | 低（本機開發） | 生產環境需要 systemd / pm2 管理 |
| 沒有 rate limiting | 高（部署前必修） | 任何人登入都可以無限送請求 |
| memory-extraction 失敗靜默 | 低 | 只有 console.error，沒有 alerting |
| PostgreSQL 連線 max:1 | 中 | 本機單用戶 OK，多用戶需要 connection pool |
