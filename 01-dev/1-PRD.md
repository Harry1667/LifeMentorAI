# Life Mentor AI — 設計文件（持續更新）

> 本文件在每次討論中同步更新。所有架構決定、功能範圍、技術選型都記錄在此。
> 最後更新：2026-04-06

---

## 產品定義

**核心價值主張**：一個越用越了解你的 AI 導師系統。記憶累積是護城河——用了 6 個月的 Life Mentor AI 比 ChatGPT 更有價值，因為它記得你拒絕過什麼、接受過什麼、你的偏好是什麼。

**目標用戶（切入點）**：台灣大學生，尤其是實習中遇到職場困境的學生。

**創辦人即用戶**：創辦人自己是目標用戶，這是最強的需求驗證。

**功能優先級（最重要 → 次要）**：
1. 長期記憶（系統記得你是誰）
2. 多導師視角（不同觀點碰撞）
3. 行動追蹤（建議執行情況）

---

## 競品分析

| 競品 | 缺點 |
|------|------|
| ChatGPT / Claude | 沒有長期記憶、單一觀點、給完就算 |
| Pi | 單一 AI 人格，無多觀點辯論 |
| Rocky.ai | 企業導向，非個人使用 |
| Purpose | 單一 AI，無真正多導師 |

**EUREKA 洞察**：競品假設「單一 AI = 信任」。但圓桌辯論模型更誠實——讓用戶看到問題沒有標準答案，不同智慧有不同詮釋。這才是有深度的人生指導。

---

## 技術架構（最終決定）

### 核心原則：所有資料都放在自己的伺服器

**決定**：記憶、導師資料、行動記錄、向量資料庫——全部使用自托管服務，不依賴 Mem0 Cloud、Pinecone 等第三方存儲。理由：資料主權是護城河的一部分，不能讓第三方服務的漲價或停服摧毀核心功能。

### 技術棧

| 類別 | 選擇 | 說明 |
|------|------|------|
| 前端 | Next.js 14 (App Router) | |
| 身份驗證 | Clerk | 處理登入，提供 userId |
| AI 模型 | Anthropic Claude API (claude-sonnet-4-6) | |
| 串流 | Vercel AI SDK (`streamText`) | 原生支援 Next.js |
| 主資料庫 | Supabase (PostgreSQL) | 記憶、行動記錄、導師資料全存這裡 |
| 向量搜尋 | pgvector（PostgreSQL 擴充套件） | 取代 Pinecone，在 Supabase 內運行 |
| 部署 | Vercel | C0 用 Hobby，C1 升級 Pro |

### 資料流（C0）

```
用戶輸入訊息
  → Next.js API Route (/api/chat)
    → Clerk auth() 取得 userId（不信任 body 的 userId）
    → 從 Supabase 讀取用戶記憶（LIMIT 20，按 updated_at DESC）
    → 組合 system prompt（導師角色 + 用戶記憶上下文）
    → 呼叫 Anthropic API（串流，Vercel AI SDK）
    → 回傳串流給前端
    → 串流結束後（onFinish callback）：
        → [Call 2] 記憶提取 LLM 呼叫：
              prompt: "從以下對話中提取用戶的重要資訊（決定、偏好、話題），
                      以 JSON 格式回傳，符合 Memory 型別定義"
              input: 完整對話記錄
              output: Memory[] JSON
        → 非同步寫入 Supabase（失敗靜默，記錄 error log）
```

**注意**：C0 每次對話 = 2 個 Anthropic API 呼叫（導師回應 + 記憶提取）。
成本估算：2 × $0.003/1K tokens × 平均 2K tokens = 約 $0.012/對話。

### API Contract

```
POST /api/chat
Body: {
  mentor: "franklin" | "feynman" | "stoic" | string,  // 預設或自定義
  message: string
  // 注意：userId 不在 body 裡，由伺服器端 Clerk auth() 取得
}
Response: SSE stream（Vercel AI SDK 格式）
```

**安全原則**：`userId` 永遠只從 `auth()` 取得，不接受 body 傳入：
```typescript
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  const { mentor, message } = await req.json()
  // 使用 userId（來自 Clerk），絕對不用 body.userId
}
```

### 頁面路由

| 路由 | 說明 |
|------|------|
| `/` | 登入頁（Clerk） |
| `/chat` | 主對話頁 |
| `/mentors` | 導師選擇/自定義（C1） |
| `/actions` | 行動追蹤看板（C1） |
| `/api/chat` | 後端 API Route |
| `/api/memory` | 記憶讀寫（可獨立測試） |

---

## TypeScript 型別定義

所有核心型別定義在 `/lib/types/memory.ts`，實作時必須建立：

```typescript
// /lib/types/memory.ts
export type TopicMemory = {
  type: 'topic'
  topic: string
  detail: string
}

export type DecisionMemory = {
  type: 'decision'
  decision: string
  outcome: 'accepted' | 'rejected' | 'in_progress'
  progress?: number
}

export type PreferenceMemory = {
  type: 'preference'
  dislike?: string
  like?: string
  reason: string
}

export type MilestoneMemory = {
  type: 'milestone'
  description: string
  date: string
}

export type Memory = TopicMemory | DecisionMemory | PreferenceMemory | MilestoneMemory

export interface MemoryRecord {
  id: string
  user_id: string
  type: Memory['type']
  content: Memory
  created_at: string
  updated_at: string
}
```

**導師人格介面**（自定義導師與預設導師共用）：
```typescript
// /lib/types/persona.ts
export interface Persona {
  id: string
  name: string          // 顯示名稱（中文）
  fullName: string      // 英文全名
  archetype: string     // 一行描述
  systemPrompt: string  // Claude system prompt
  domain: string        // 擅長領域
}
```

---

## 導師人格

### 預設導師（C0）

導師人格以 TypeScript 檔案儲存在 `/lib/personas/` 資料夾：

```typescript
// /lib/personas/franklin.ts
export const franklinPersona = {
  id: "franklin",
  name: "富蘭克林",
  fullName: "Benjamin Franklin",
  archetype: "紀律與務實主義者",
  systemPrompt: `你是班傑明·富蘭克林。你強調紀律、時間管理與自我提升。
你的建議務實、具體、可執行。你相信透過持續的小習慣可以達成大目標。
你說話直接，會給出明確的行動步驟。你的口吻是智慧長者，而非學術教授。`,
  domain: "習慣、時間管理、自律、職業道德"
}

// /lib/personas/feynman.ts
export const feynmanPersona = {
  id: "feynman",
  name: "費曼",
  fullName: "Richard Feynman",
  archetype: "好奇心驅動的學習者",
  systemPrompt: `你是理查·費曼。你相信理解重於記憶，善用類比解釋複雜問題。
你鼓勵用戶用自己的話解釋問題（費曼學習法）。你對一切充滿好奇，
會問「為什麼」直到找到根本原因。你的口吻輕鬆但深刻。`,
  domain: "學習方法、問題拆解、創意思考"
}

// /lib/personas/stoic.ts
export const stoicPersona = {
  id: "stoic",
  name: "斯多葛導師",
  fullName: "Marcus Aurelius / Epictetus",
  archetype: "情緒穩定的哲學家",
  systemPrompt: `你是斯多葛哲學的導師（融合馬可·奧理略與愛比克泰德的智慧）。
你強調控制圈（只關注可控的事）、接受不可控的事、情緒穩定。
你會幫助用戶區分「什麼是我能改變的，什麼不是」。口吻平靜、深思熟慮。`,
  domain: "情緒管理、壓力處理、人生哲學"
}
```

---

## 記憶系統（Supabase）

### Supabase 連線設定

**重要**：使用 Supabase **Transaction Mode Pooler** 連線字串，不要用直接連線字串。
Vercel Serverless 每次請求建一個新連線，PostgreSQL 預設上限 100 個。
Pooler 連線字串在 Supabase Dashboard → Settings → Database → Connection Pooling。

### 資料庫 Schema

```sql
-- 用戶記憶表
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,  -- 來自 Clerk
  type TEXT NOT NULL,     -- 'topic' | 'decision' | 'preference' | 'milestone'
  content JSONB NOT NULL,
  importance INTEGER DEFAULT 5,  -- 1-10，記憶長期重要性（見下方說明）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- content 格式範例：
-- type='topic':      { "topic": "職場壓力", "detail": "覺得主管指示不清" }
-- type='decision':   { "decision": "使用番茄鐘", "outcome": "accepted", "progress": 30 }
-- type='preference': { "dislike": "需要多人協作的學習法", "reason": "目前沒有共學對象" }

-- 行動追蹤表（C1）
CREATE TABLE actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  advice_text TEXT NOT NULL,
  status TEXT DEFAULT 'accepted',  -- 'accepted' | 'in_progress' | 'rejected' | 'completed'
  progress_pct INTEGER DEFAULT 0,
  rejection_reason TEXT,           -- 可選，用戶填寫
  mentor_source TEXT,              -- 哪個導師給的建議
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 對話記錄表（可選，用於每週摘要）
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  mentor TEXT NOT NULL,
  message_role TEXT NOT NULL,  -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_user_importance ON memories(user_id, importance DESC, updated_at DESC);
CREATE INDEX idx_actions_user_id ON actions(user_id);
CREATE INDEX idx_conversations_user_id_created ON conversations(user_id, created_at);
```

---

## 辯論機制（C1 重要決定）

**決定**：辯論採用**多輪串行機制**，不是三個並行 API 呼叫。

### 為什麼不用並行？
並行 API 呼叫的導師永遠看不到對方的論點，展示的「辯論過程」是假的。

### 串行多輪流程

```
Step 1: 導師 A（富蘭克林）讀取用戶問題 → 給出觀點 A
Step 2: 導師 B（費曼）讀取「用戶問題 + A 的觀點」→ 給出觀點 B（可以回應 A）
Step 3: 導師 C（斯多葛）讀取「用戶問題 + A + B 的觀點」→ 給出觀點 C
Step 4: 整合呼叫（主持人）讀取所有三個觀點 → 合成最終建議

總計：4 個串行 API 呼叫
估計時間：15-25 秒（有串流，用戶看到過程）
```

### 辯論 UI（聊天泡泡式）

```
┌─────────────────────────────────────────────────┐
│  [富蘭克林] 我認為你應該建立固定的早晨例行...   │
│  [費曼] 富蘭克林說得有道理，但我想問你...       │
│  [斯多葛] 聽了前兩位的觀點，我想補充...        │
│  [主持人] 綜合三位導師的觀點，我建議...        │
└─────────────────────────────────────────────────┘
```

### 部分失敗處理

4 個串行呼叫中任一步驟失敗時的處理方式：

```
Step 1 失敗 → 顯示錯誤，引導用戶重試
Step 2 失敗 → 顯示 Step 1 結果 + "費曼暫時無法回應，以下是富蘭克林的觀點"
Step 3 失敗 → 顯示 Step 1-2 結果 + 錯誤提示
Step 4（整合）失敗 → 顯示 Step 1-3 各自的觀點（無整合）
```

UI 行為：每個 Step 完成就立即串流顯示。用戶看到過程，不會等待一個黑盒。

### Vercel 超時解法

- C0（2 個呼叫：導師 + 記憶提取）：Hobby Plan 夠用（< 10 秒）
- C1（4 個串行呼叫）：需要 **Vercel Pro**（支援長時間串流函數）或改用 **Vercel Fluid Compute**

---

## 自定義導師（C1）

用戶輸入任意人物名稱，系統組裝該人物的回應風格。

### 技術實作
```typescript
// 自定義導師的 system prompt 組裝
async function buildCustomPersonaPrompt(personaName: string): Promise<string> {
  // 用 Brave/Tavily Search API 搜尋該人物的公開資訊
  const searchResults = await searchPublicInfo(personaName)
  
  // 用 Claude 從搜尋結果中提取：
  // - 核心價值觀
  // - 思考風格
  // - 常用論述方式
  const personaProfile = await extractPersonaProfile(personaName, searchResults)
  
  return buildSystemPrompt(personaProfile)
}
```

### 輸入審查（必要安全措施）
- 過濾已知的爭議性人物名單（獨裁者、極端思想人物）
- 對於不確定的人物：先生成，再讓用戶確認「這個角色是否符合你的期望」
- 記錄所有自定義導師請求，供後期審查

---

## 每週成長摘要（C1）

### 觸發機制
- Vercel Cron Job（Pro Plan 才能每週執行）
- 或：用戶主動點擊「產生本週摘要」按鈕（Hobby Plan 可行）

### 摘要內容
```
本週成長摘要 - 2026-04-06

📝 你這週討論了：
- 職場溝通問題（週一）
- 時間管理策略（週三）

✅ 已完成的行動：
- 番茄鐘工作法（你說完成了 80%）

🤔 導師觀察到的模式：
- 你傾向接受「小步驟」的建議，拒絕「需要他人合作」的方案
- 下週的建議可能更適合你：...

💡 下週建議回顧：
- 上週提到睡眠問題，有改善嗎？
```

---

## 偏好學習（C1）

系統分析用戶的行動記錄，自動更新「用戶偏好標籤」：

```sql
-- 偏好標籤表
CREATE TABLE user_preferences (
  user_id TEXT NOT NULL,
  preference_key TEXT NOT NULL,  -- 例如 'learning_style', 'social_preference'
  preference_value TEXT NOT NULL, -- 例如 'solo_learning', 'structured_steps'
  confidence FLOAT DEFAULT 0.5,   -- 0-1，隨樣本數增加
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, preference_key)
);
```

**注意**：偏好學習需要至少 20 次行動記錄才有效。初期只做樣本收集，不做推論。

---

## 記憶重要性評分（importance）

記憶提取 LLM 呼叫同時評估 importance（1-10）：

| 分數 | 意義 | 例子 |
|------|------|------|
| 10 | 核心價值觀/人格特質 | 「我非常重視自律」 |
| 8 | 長期偏好 | 「不喜歡需要多人協作的學習法」 |
| 5 | 具體決定 | 「本週試用番茄鐘工作法」 |
| 3 | 短暫話題/情緒 | 「今天跟主管開會氣氛不好」 |
| 1 | 一次性細節 | 「明天要交報告」 |

記憶查詢：
```sql
SELECT * FROM memories
WHERE user_id = $1
ORDER BY importance DESC, updated_at DESC
LIMIT 20
```

高 importance 的記憶（長期偏好、核心價值觀）永遠進入 context。
低 importance 的記憶（短暫話題）隨時間自然被排擠出去。

記憶提取 prompt 回傳格式加入 importance：
```json
{ "type": "preference", "dislike": "多人協作", "reason": "...", "importance": 8 }
```

---

## 實作階段

### C0（2 週）— 對話記憶原型

**目標**：一個能記住你的 AI 導師。

**功能清單**：
- [ ] Clerk 身份驗證（登入/登出）
- [ ] 3 個預設導師（選擇後開始對話）
- [ ] 對話介面（串流顯示）
- [ ] Supabase 記憶讀寫（對話結束後提取關鍵點儲存）
- [ ] 下次對話自動載入記憶上下文

**C0 完成門檻**（通過才進 C1）：
- 創辦人自己連續使用 1 週，至少 5 次對話
- 第 5 次對話中，系統主動提到之前至少 1 個細節（不需提示）
- 主觀評分「感覺它在了解我」≥ 4/5

---

### C1（C0 驗證後，估計 2 個月）— 多 Agent 圓桌 + 擴充

**功能清單**：
- [ ] 串行多輪辯論機制（4 個串行 API 呼叫）
- [ ] 辯論可視化 UI（聊天泡泡，導師輪流發言）
- [ ] 行動追蹤（接受/進行中 X%/拒絕）
- [ ] 自定義導師（輸入人物名稱，搜尋組裝人格）
- [ ] 每週成長摘要（Cron Job 或手動觸發）
- [ ] 偏好學習（收集數據，20+ 樣本後開始推論）
- [ ] 升級 Vercel Pro（支援長時間串流函數）

**C1 完成門檻**（通過才進 C2）：
- 至少 1 個自定義導師被建立且正常運作
- 至少 1 個行動被標記「接受」後更新為「已完成」
- 辯論流程（4 步串行）在 30 秒內完成（有串流）
- 每週摘要至少成功產生 1 次

---

### C2（C1 驗證後，估計 3 個月，條件啟動）

**啟動條件**：C1 驗證用戶確實需要「有書籍根據的引用」才啟動。如果記憶 + 多觀點已足夠，C2 可無限期延後。

**功能清單**：
- [ ] pgvector 向量搜尋（在 Supabase 內）
- [ ] 公眾領域著作向量化（富蘭克林自傳、馬可·奧理略《沉思錄》等）
- [ ] Wikipedia CC BY-SA 內容整合
- [ ] 即時搜尋 API（Tavily / Brave Search）

---

## 已知風險與對策

| 風險 | 嚴重度 | 對策 |
|------|--------|------|
| Vercel 10 秒超時（C1 串行呼叫）| 高 | 升級 Vercel Pro；或用 streaming + keepalive |
| 自定義導師輸入爭議人物 | 中 | 建立過濾名單；用戶確認機制 |
| 偏好學習樣本不足 | 中 | 前 20 次只收集，不推論 |
| 每週摘要品質不夠好被忽略 | 中 | 讓用戶手動觸發，不強制推送 |
| C1 範圍太大一次建不完 | 高 | 每個功能獨立可上線，不要一次全做完才部署 |

---

## UI 設計規格

### 視覺語言

| 元素 | 值 |
|------|-----|
| 整體風格 | 深色、溫暖、探秘（如在夫黑書房與智者對話） |
| 背景色 | `#1a1814`（深灰帶暖色） |
| 對話區背景 | `#13100d` |
| 導師氣泡背景 | `#252017` |
| 主要文字 | `#e8e4df`（溫暖白） |
| 次要文字 | `#9ca3af` |
| 點綴色 | `#d97706`（琥珀金，用於高亮/互動元素） |

**導師代表色（字母縮寫徽章）**：

| 導師 | 縮寫 | 顏色 |
|------|------|------|
| 富蘭克林 | F | `#2563eb`（深藍） |
| 費曼 | R | `#16a34a`（深綠） |
| 斯多葛 | M | `#71717a`（深灰） |

**字型**：使用有個性的 serif 或 semi-serif（不用 Inter/Roboto 等預設）。建議：Lora（正文）、Fraunces（導師名）。

---

### 頁面佈局：`/chat`

```
桌面版（>768px）
┌──────────────┬────────────────────────────────────────┐
│              │  [品牌名] Life Mentor           [用戶↓]│
│  [●F] 富蘭克林│ ───────────────────────────────────── │
│  [○R] 費曼   │                                        │
│  [○M] 斯多葛 │  [F] 富蘭克林 09:42                    │
│  ──────────  │  「我建議你建立固定的晨間例行...」        │
│  [+ 新對話]  │                                        │
│              │                       你  09:43        │
│  今天        │                   「謝謝，但我想問...」 │
│  • 職場溝通  │                                        │
│              │  [R] 費曼 正在回應...                  │
│              │  ●●● （刻字動畫）                      │
│              │ ───────────────────────────────────────│
│              │  [輸入框：問問你的導師...] [禁用 Send ▶]│
└──────────────┴────────────────────────────────────────┘

手機版（≤768px）
┌─────────────────────────┐
│ [品牌]    富蘭克林   [↓]│
│                         │
│ [F] 「我建議你...」      │
│                         │
│         你 「謝謝...」  │
│                         │
│ [input.................] │
├─────────────────────────┤
│  [F]富蘭  [R]費曼  [M]斯多  [≡]│
└─────────────────────────┘
```

---

### 互動狀態規格

| 狀態 | 用戶看到什麼 |
|------|------------|
| **空狀態（第一次登入）** | 預設導師（富蘭克林）主動打招呼：「我是富蘭克林。提出一個讓你困擾的問題，我們一起想。」每個導師有各自的歡迎詞。 |
| **回訪用戶** | 側欄顯示上次對話標題。最近的對話自動恢復。 |
| **輸入送出後（等待中）** | 導師氣泡出現，顯示「富蘭克林思考中 ●●●」刻字動畫。輸入框禁用 + placeholder 改為「導師思考中...」 |
| **串流中** | 文字逐字出現（Vercel AI SDK 原生支援）。 |
| **C1 辯論串行中** | 依序顯示：「富蘭克林思考中 ●●●」→ 出現回應 → 「費曼正在聆聽富蘭克林...」→ 出現回應 → ... |
| **C1 辯論部分失敗** | 已完成的步驟正常顯示，失敗的步驟顯示「斯多葛暫時無法回應」的淡色氣泡。 |
| **錯誤狀態** | 氣泡底部顯示「回應中斷，點此重試 ↩」 |
| **Supabase 寫入失敗** | 靜默失敗，用戶不知道。後台 log。 |

---

### 對話後行動卡片

導師回應結束後，系統自動從回應中提取 1-2 個可執行建議，顯示為小卡片：

```
────────────────────────────────────────
  💡 富蘭克林建議的行動：
  「試用番茄鐘工作法，從明天早上開始」
  [✔ 接受]  [↩ 以後再說]
────────────────────────────────────────
```

行動卡片的接受/拒絕狀態寫入 `actions` 表，C1 的行動追蹤頁面讀取這個資料。

---

### 資訊架構決定

| 決定 | 選擇 | 原因 |
|------|------|------|
| 導師切換位置 | 左側欄（桌面）/ 底部 Tab Bar（手機） | 高頻操作，常駐可見 |
| 對話氣泡對齊 | 導師靠左，用戶靠右 | 符合「導師是外部聲音」的心理模型 |
| 導師視覺識別 | 字母縮寫 + 代表色（不用圖片） | 避免 AI 生成圖片的樣板感 |
| 首次空狀態 | 導師主動打招呼（個性化歡迎詞） | 第一印象是說服力最強的時刻 |

---

## 測試策略

### C0 測試清單

**Unit Tests**（`/tests/unit/`）：
- [ ] `auth()` 回傳 null 時 API 回傳 401
- [ ] `auth()` 成功時，不使用 body.userId
- [ ] 記憶查詢：LIMIT 20，按 updated_at DESC
- [ ] 新用戶（0 筆記憶）：system prompt 正確生成
- [ ] 回訪用戶（有記憶）：system prompt 包含記憶上下文
- [ ] TopicMemory / DecisionMemory / PreferenceMemory 型別正確
- [ ] Anthropic 串流失敗：回傳正確錯誤
- [ ] Supabase 寫入失敗：靜默（不拋錯誤到用戶）

**E2E Tests**（`/tests/e2e/`）：
- [ ] 新用戶第一次對話 → 確認記憶被建立（查 Supabase）
- [ ] 第二次對話 → 確認 system prompt 包含上次對話的記憶
- [ ] Clerk session 過期 → 被正確引導重新登入

**Eval Tests**（`/evals/memory-extraction.ts`）：
```typescript
// 測試案例格式
const evalCases = [
  {
    conversation: "用戶說：我決定要開始用番茄鐘工作法",
    expected: { type: 'decision', decision: '番茄鐘工作法', outcome: 'accepted' }
  },
  {
    conversation: "用戶說：我不喜歡需要跟別人一起學習的方法",
    expected: { type: 'preference', dislike: '需要多人協作的學習法' }
  },
  // ... 至少 8 個案例
]
```
評分標準：type 正確 + 關鍵內容對得上（不要求完全相同）。

---

## 隱私與法律

- **台灣個資法**：用戶記憶資料（個人偏好、決定、困境）屬於個人資料，需要隱私政策聲明
- **版權**：C0/C1 完全不爬取任何有版權內容；自定義導師只用搜尋時即時取得的公開資訊
- **資料存儲**：全部存在 Supabase（自托管），不依賴第三方記憶服務

---

## 未在此版本範圍內

- 圖形資料庫（Graph DB）— 用 PostgreSQL + pgvector
- 手機 App — 先做 Web
- 語音介面 — 延後
- 社群功能（分享建議）— 延後
- 用戶檔案頁面 — 移到 C2
- 多用戶協作 — 延後

---

## 待辦事項（TODO）

| 優先級 | 項目 | 說明 |
|--------|------|------|
| P1 | 設計多輪辯論的串行架構 | 在 C1 開始前先 Spike：測試 4 步串行 API 的連貫性 |
| P1 | 記憶提取 Eval 測試組 | C0 開發時建立 `/evals/memory-extraction.ts`，至少 8 個測試案例 |
| P1 | 限流保護 | C1 公開前必須實作，建議 Upstash Redis，20 請求/小時/用戶 |
| P2 | 自定義導師輸入審查機制 | 建立爭議人物過濾名單 |
| P2 | 建立成本試算模型 | 50 活躍用戶 × 10 訊息/天的 API 費用試算（C0 每對話 2 呼叫） |
| P2 | 錯誤監控 | Sentry 或 Axiom 追蹤 Supabase 寫入失敗（目前靜默失敗但應可觀測） |
| P3 | 隱私政策文件 | 符合台灣個資法（C0 單人使用，P3 等公開前再處理） |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | issues_open | 4 scope proposals accepted, 0 deferred |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 9 issues found & resolved, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (PLAN) | score: 2/10 → 8/10, 8 decisions made |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0 decisions unresolved
**VERDICT:** ENG + DESIGN CLEARED — Architecture, tests, and UI design reviewed. Ready to implement C0.
