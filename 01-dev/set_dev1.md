# Life Mentor AI — 開發工作階段紀錄

> 工作階段：2026-04-07（接續 set_dev.md）

---

## 本次完成的工作

### 1. 資料庫連線（PostgreSQL @ aaPanel）

- 修正 `pg_hba.conf`：允許外部連線（`lifementorai` 用戶 + `0.0.0.0/0`）
- 確認連線使用者名稱全小寫：`lifementorai`（非 `lifementoraI`）
- 更新 `.env.local` DATABASE_URL 修正大小寫
- 建立所有表格（見下方）

### 2. 資料庫表格

在 aaPanel PostgreSQL 執行，現在共有：

| 表格 | 用途 |
|------|------|
| `memories` | 用戶記憶（C0 核心） |
| `actions` | 行動追蹤（C1 用） |
| `custom_personas` | 管理後台新增的導師 |
| `theories` | 管理後台新增的理論 |
| `conversations` | 每個導師的對話記錄（持久化） |

### 3. AI Proxy 關鍵修復

**根本原因**：AI SDK v6 的 `createOpenAI()` 預設呼叫 `/v1/responses`（OpenAI 新 API），但 Python Bridge 只實作 `/v1/chat/completions`。

**修復方式**（`ai-proxy.ts`）：
```ts
// 錯誤：直接呼叫 provider() 會走 /v1/responses → 404
export const proxy = createOpenAI(...)

// 正確：用 .chat() 強制走 /v1/chat/completions
const _provider = createOpenAI(...)
export const proxy = (model: string) => _provider.chat(model)
```

**同步修正**：所有 `maxOutputTokens` → `maxTokens`（`generateText` 用）

### 4. 管理後台（`/admin`）

功能：
- **導師管理**：輸入人名 → AI 分析生成完整 persona → 可編輯 → 新增到 DB
- **理論管理**：輸入理論名稱 → AI 分析生成結構化資料 → 新增到 DB
- 側欄新增「管理導師 / 理論」連結

API routes：
- `POST /api/admin/analyze` → AI 分析（mentor / theory）
- `GET|POST|DELETE /api/admin/personas` → 自訂導師 CRUD
- `GET|POST|DELETE /api/admin/theories` → 理論 CRUD
- `GET /api/personas` → 合併 hardcoded + 自訂導師

### 5. 對話持久化

- `conversations` 表：`(user_id, mentor_id)` 複合主鍵，存 JSONB 訊息
- API：`GET /api/conversations?mentor=x`、`PUT /api/conversations`
- Chat page：切換導師時自動載入，AI 回應完成後自動儲存
- 每個導師對話各自獨立

### 6. 速率限制

`/api/chat` 加 in-memory rate limiting：每個用戶每分鐘最多 20 次請求。

### 7. Chat 串流問題

- 確認 AI 回應有正確到達（POST 200，13 秒）
- 訊息資料結構正確（user + assistant parts 都有文字）
- 加 `whitespace-pre-wrap` 支援 AI 回應換行
- Auto-scroll 改為 `instant`

---

## 已知問題（尚未解決）

| 問題 | 說明 |
|------|------|
| **AI 回應不顯示** | 資料層正確（debug 確認），但訊息泡泡沒有在畫面上呈現。疑似 CSS/Layout 問題。需要用有 login session 的瀏覽器 debug。 |
| Memory extraction 用英文 | `claude-haiku-4-5` 用英文回傳 JSON，導致 parse 失敗。需加更強的 prompt 約束。 |
| conversations 載入時機 | `useEffect([activeMentorId])` 在初始渲染也會觸發，可能和 setMessages 有競爭。 |

---

## 下一步

### 緊急（解決 AI 回應顯示問題）

1. **Debug CSS Layout**
   - 在有 Clerk session 的瀏覽器打開 DevTools → Console
   - 確認有沒有 React 錯誤
   - 確認 `.flex-1.overflow-y-auto` 的高度是否正確
   - 試試：把訊息列表 div 的 `flex-1` 改成 `min-h-0 flex-1`

2. **快速驗證方式**
   - 打開 DevTools → Elements → 找到訊息列表 div → 看裡面有沒有 MessageBubble
   - 如果有 div 但看不到：顏色/z-index 問題
   - 如果沒有 div：React state 沒有觸發 re-render

### C0 收尾 checklist

- [ ] 修好 AI 回應顯示問題
- [ ] 測試記憶寫入 DB（對話後查 `SELECT * FROM memories WHERE user_id = '...'`）
- [ ] 確認記憶在下一次對話被注入（重整後再問同樣話題）
- [ ] Memory extraction 改用繁體中文 prompt（修 haiku 英文問題）
- [ ] 測試自訂導師對話（admin 新增 → 聊天選擇 → 正常回應）
- [ ] 測試對話持久化（切換導師 → 切回來 → 記錄還在）

### C0 → C1 過渡

- [ ] 自用 2 週收集真實痛點
- [ ] 確認記憶提取品質（haiku 提取的是否有用）
- [ ] 考慮記憶 deduplication

### C1 實作（未來）

- [ ] 串行辯論 API route（`/api/debate`）
- [ ] Synthesizer 導師人格
- [ ] 辯論 UI（四個訊息串連顯示）
- [ ] 理論與導師綁定（讓導師在對話中融入特定理論）
- [ ] 行動追蹤 UI

---

## 啟動方式（更新版）

```bash
# 終端 1：Python Bridge
cd 01-dev/use_proxycli
python3.11 -m uvicorn server:app --host 127.0.0.1 --port 8765

# 確認
curl http://127.0.0.1:8765/health  # → {"status":"ok"}

# 終端 2：Next.js
cd 02-web
npm run dev  # → http://localhost:3000
```

---

## 技術重點備忘

### AI SDK v6 正確用法

```ts
// ✅ streamText（chat route）
streamText({
  model: proxy('claude-sonnet-4-6'),  // proxy = (model) => _provider.chat(model)
  maxTokens: 600,
  ...
})

// ✅ generateText（memory extraction, admin analyze）
generateText({
  model: proxy('claude-haiku-4-5'),
  maxTokens: 500,
  ...
})

// ✅ 回傳
return result.toUIMessageStreamResponse()
```

### PostgreSQL 連線

```
Host: 57.182.129.192:5432
User: lifementorai（全小寫）
DB:   lifementorai（全小寫）
```

### 管理後台

```
http://localhost:3000/admin
```
