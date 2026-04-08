import { auth } from '@clerk/nextjs/server'
import { generateText } from 'ai'
import { proxy } from '@/lib/ai-proxy'
import { getUserMemories } from '@/lib/supabase/client'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

export const maxDuration = 30

// POST — 產生本週成長摘要
export async function POST() {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  // 取得過去 7 天的對話
  const sessions = await sql`
    SELECT type, title, mentor_ids, messages, created_at
    FROM chat_sessions
    WHERE user_id = ${userId} AND created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at ASC
  `

  // 取得行動紀錄
  const actions = await sql`
    SELECT advice_text, status, progress_pct, mentor_source, created_at, updated_at
    FROM actions
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 20
  `

  // 取得記憶
  const memories = await getUserMemories(userId)

  if (sessions.length === 0 && actions.length === 0) {
    return Response.json({
      summary: '這週還沒有對話紀錄。和導師聊聊，下次再來產生摘要吧！',
      generated: false,
    })
  }

  // 組合對話摘要
  const conversationSummary = sessions.map((s) => {
    const msgs = (typeof s.messages === 'string' ? JSON.parse(s.messages) : s.messages) as Array<{ role?: string; content?: string; parts?: Array<{ type: string; text?: string }> }>
    const userMsgs = msgs
      .filter((m) => m.role === 'user')
      .map((m) => {
        if (m.parts) {
          const t = m.parts.find((p) => p.type === 'text')
          return t?.text ?? ''
        }
        return m.content ?? ''
      })
      .filter(Boolean)
      .slice(0, 3) // 每段對話取前 3 條用戶訊息

    const type = s.type === 'roundtable' ? '圓桌群聊' : '對話'
    return `${type}（${new Date(s.created_at).toLocaleDateString('zh-TW')}）：${userMsgs.join('、')}`
  }).join('\n')

  const actionSummary = actions.map((a) => {
    const statusMap: Record<string, string> = {
      accepted: '已接受',
      in_progress: `進行中 ${a.progress_pct}%`,
      completed: '已完成',
      rejected: '已拒絕',
    }
    return `- ${a.advice_text}（${statusMap[a.status] ?? a.status}，來自 ${a.mentor_source ?? '導師'}）`
  }).join('\n')

  const memoryContext = memories.map((m) => {
    const c = m.content as Record<string, string>
    switch (m.type) {
      case 'topic': return `- 討論話題：${c.topic}`
      case 'decision': return `- 決定：${c.decision}（${c.outcome}）`
      case 'preference': return c.dislike ? `- 不喜歡：${c.dislike}` : `- 喜歡：${c.like}`
      case 'milestone': return `- 里程碑：${c.description}`
      default: return ''
    }
  }).filter(Boolean).join('\n')

  try {
    const { text } = await generateText({
      model: proxy('claude-sonnet-4-6'),
      system: `你是 Mentora 的成長摘要助理。用溫暖、鼓勵但誠實的語氣撰寫每週成長報告。用繁體中文。`,
      prompt: `請根據以下資料，產生本週成長摘要。

本週對話紀錄：
${conversationSummary || '（無對話紀錄）'}

行動追蹤：
${actionSummary || '（無行動紀錄）'}

用戶已知的記憶/偏好：
${memoryContext || '（尚無記憶）'}

請按以下格式輸出（用 markdown）：

## 本週成長摘要

### 你這週討論了
（列出主要話題，2-4 項）

### 行動進展
（列出行動的狀態和進度）

### 導師觀察到的模式
（根據對話和行動記錄，指出 1-2 個用戶的行為模式或偏好趨勢）

### 下週建議
（根據以上分析，給出 1-2 個具體的下週建議）`,
      maxOutputTokens: 800,
    })

    return Response.json({ summary: text, generated: true })
  } catch (err) {
    console.error('[Summary] 產生失敗:', err)
    return new Response('Failed to generate summary', { status: 500 })
  }
}
