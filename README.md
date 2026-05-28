# LifeMentorAI（圓桌智者）

AI 人生導師對話平台 — 多位歷史智者角色同台，提供人生建議、決策輔助、心理支持。核心護城河是**長期記憶**：系統記得你是誰、你拒絕過什麼、你的偏好是什麼，越用越了解你。

## 核心價值
- 競品（ChatGPT / Claude）沒有長期記憶、只有單一觀點
- **圓桌辯論模型**：讓用戶看到問題沒有標準答案，不同智慧有不同詮釋
- 記憶累積是護城河——用了 6 個月的 LifeMentorAI 比 ChatGPT 更有價值

## 預設導師（三位）

| 導師 | 代號 | 專長領域 |
|------|------|----------|
| 富蘭克林 Benjamin Franklin | F | 習慣、時間管理、自律、職業道德 |
| 費曼 Richard Feynman | R | 學習方法、問題拆解、費曼學習法 |
| 斯多葛 Marcus Aurelius | M | 情緒管理、控制圈、壓力處理 |

## 功能模組

### C0（已上線）— 對話記憶原型
- 三個預設導師選擇後開始對話（串流輸出）
- **長期記憶系統**：每次對話結束後 AI 自動提取關鍵點寫入資料庫，下次對話自動載入
- 記憶類型：Topic / Decision / Preference / Milestone，每條附重要性評分（1–10）
- 重要性 10 = 核心價值觀（永遠進入 context）；重要性 3 = 短暫話題（自然被排擠）
- Clerk 身份驗證（Google / Email 登入）

### C1（規劃中）— 圓桌辯論 + 行動追蹤
- **串行多輪辯論**：4 個串行 API 呼叫（A 觀點 → B 讀 A 再回應 → C 讀 A+B → 主持人整合）
- **行動卡片**：每次回應後自動提取 1–2 個可執行建議，可標記「接受 / 進行中 / 完成 / 拒絕」
- **自定義導師**：輸入任意人物名稱，AI 搜尋公開資料組裝人格
- 每週成長摘要（Cron Job 觸發）
- 偏好學習（20+ 樣本後開始推論）

## 資料流（C0）
```
用戶輸入
  → /api/chat（Clerk auth 取 userId）
  → 從 Supabase 讀取記憶（LIMIT 20, importance DESC）
  → 組合 system prompt（導師角色 + 用戶記憶）
  → Anthropic API 串流回應
  → onFinish → 記憶提取 LLM 呼叫 → 寫入 Supabase（非同步，失敗靜默）
```

## 頁面路由
| 路由 | 說明 |
|------|------|
| `/` | 登入頁 |
| `/chat` | 主對話頁（導師側欄 + 訊息區） |
| `/actions` | 行動追蹤看板（C1）|
| `/summary` | 成長摘要（C1）|
| `/admin` | 管理員後台 |

## 技術棧
- **前端**：Next.js 14（App Router）+ TypeScript + Tailwind CSS v4
- **Auth**：Clerk（userId 只從伺服器端 `auth()` 取得，不信任 body）
- **AI**：Anthropic Claude（claude-sonnet-4-6）透過 ProxyCLI；Vercel AI SDK 串流
- **資料庫**：Supabase（PostgreSQL）+ pgvector（向量搜尋，C2 啟動後）
- **部署**：Vercel

## 資料庫 Schema（核心表）
```sql
-- 用戶記憶表
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,          -- 來自 Clerk
  type TEXT NOT NULL,             -- 'topic' | 'decision' | 'preference' | 'milestone'
  content JSONB NOT NULL,
  importance INTEGER DEFAULT 5,   -- 1-10，決定記憶是否進入 context
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 行動追蹤表（C1）
CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  advice_text TEXT NOT NULL,
  status TEXT DEFAULT 'accepted',  -- 'accepted' | 'in_progress' | 'rejected' | 'completed'
  progress_pct INTEGER DEFAULT 0,
  mentor_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
完整 schema：`02-web/src/lib/supabase/schema.sql`

## 環境變數
```bash
# 複製範本
cp 02-web/.env.local.example 02-web/.env.local
```

| 變數 | 說明 |
|------|------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk 公開金鑰 |
| `CLERK_SECRET_KEY` | Clerk 密鑰 |
| `AI_PROXY_TOKEN` | ProxyCLI token（clip.twloop.com）|
| `DATABASE_URL` | Supabase Transaction Mode Pooler 連線字串 |

**重要**：使用 Supabase **Transaction Mode Pooler** 連線字串，不要用直連字串（Vercel Serverless 每次請求建新連線，直連會耗盡 100 個連線上限）。

## 快速開始
```bash
cd 02-web
cp .env.local.example .env.local
# 填入 Clerk / DB / AI Proxy 憑證
npm install
npm run dev
# → http://localhost:3000
```

## UI 設計語言
深色書房風格，溫暖琥珀金點綴：
- 背景：`#1a1814`（深灰暖色）
- 點綴：`#d97706`（琥珀金）
- 字型：Lora（正文）/ Fraunces（導師名）
- 導師徽章：字母縮寫 + 代表色（F 深藍 / R 深綠 / M 深灰）

---

## English

An AI life-mentor platform with multiple historical sages around a round table. The moat is **long-term memory**: the system remembers who you are, what you've rejected, and what you prefer — it gets more useful the longer you use it.

### Why it exists
- Competitors (ChatGPT / Claude) have no long-term memory and only a single voice
- **Round-table debate model**: shows the user that big questions have no single right answer — different traditions read them differently
- Accumulated memory is the moat: 6 months of LifeMentorAI is more valuable to *you* than ChatGPT will ever be

### Default mentors (three)

| Mentor | Code | Domain |
|--------|------|--------|
| Benjamin Franklin | F | Habits, time management, self-discipline, work ethic |
| Richard Feynman | R | Learning methods, problem decomposition, the Feynman technique |
| Marcus Aurelius | M | Emotional regulation, the circle of control, stress |

### Modules

#### C0 (shipped) — memory-aware chat prototype
- Pick one of three mentors, start chatting (streamed responses)
- **Long-term memory**: after each session, the AI extracts key points and writes them to the DB; the next session auto-loads them
- Memory types: Topic / Decision / Preference / Milestone, each with an importance score (1–10)
- Importance 10 = core values (always in context); 3 = transient (naturally crowded out)
- Auth via Clerk (Google / email)

#### C1 (planned) — round-table debate + action tracking
- **Sequential multi-turn debate**: 4 chained API calls (A states view → B reads A and responds → C reads A+B → moderator integrates)
- **Action cards**: each response auto-extracts 1–2 actionable suggestions; mark them Accepted / In Progress / Done / Rejected
- **Custom mentors**: type any historical figure; AI gathers public info and assembles a persona
- Weekly growth digest (cron-triggered)
- Preference learning (kicks in after 20+ samples)

### Data flow (C0)
```
User input
  → /api/chat (Clerk auth → userId)
  → Read memories from Supabase (LIMIT 20, importance DESC)
  → Build system prompt (mentor persona + user memories)
  → Anthropic API streaming response
  → onFinish → memory-extraction LLM call → write to Supabase (async, silent on failure)
```

### Routes
| Route | Purpose |
|-------|---------|
| `/` | Login |
| `/chat` | Main chat (mentor sidebar + message area) |
| `/actions` | Action tracking board (C1) |
| `/summary` | Growth digest (C1) |
| `/admin` | Admin console |

### Tech stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS v4
- **Auth**: Clerk (userId taken from server-side `auth()` only — never trust the body)
- **AI**: Anthropic Claude (claude-sonnet-4-6) via ProxyCLI; Vercel AI SDK for streaming
- **Database**: Supabase (PostgreSQL) + pgvector (vector search, kicks in at C2)
- **Deploy**: Vercel

### Database schema (core tables)
```sql
-- User memory table
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,          -- from Clerk
  type TEXT NOT NULL,             -- 'topic' | 'decision' | 'preference' | 'milestone'
  content JSONB NOT NULL,
  importance INTEGER DEFAULT 5,   -- 1-10, decides whether the memory enters context
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Action tracking table (C1)
CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  advice_text TEXT NOT NULL,
  status TEXT DEFAULT 'accepted',  -- 'accepted' | 'in_progress' | 'rejected' | 'completed'
  progress_pct INTEGER DEFAULT 0,
  mentor_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
Full schema: `02-web/src/lib/supabase/schema.sql`

### Env vars
```bash
cp 02-web/.env.local.example 02-web/.env.local
```

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret |
| `AI_PROXY_TOKEN` | ProxyCLI token (clip.twloop.com) |
| `DATABASE_URL` | Supabase Transaction Mode Pooler connection string |

**Important**: use the Supabase **Transaction Mode Pooler** string, not the direct one. Vercel Serverless opens a new connection per request — direct mode burns through the 100-connection cap fast.

### Quick start
```bash
cd 02-web
cp .env.local.example .env.local
# Fill in Clerk / DB / AI Proxy credentials
npm install
npm run dev
# → http://localhost:3000
```

### UI design language
Dark library aesthetic, warm amber accents:
- Background: `#1a1814` (warm dark grey)
- Accent: `#d97706` (amber gold)
- Typography: Lora (body) / Fraunces (mentor names)
- Mentor badges: initial + signature color (F deep blue / R deep green / M deep grey)
