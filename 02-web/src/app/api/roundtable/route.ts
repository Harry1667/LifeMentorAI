import { auth } from '@clerk/nextjs/server'
import { generateText } from 'ai'
import { proxy } from '@/lib/ai-proxy'
import { PERSONAS } from '@/lib/personas'
import { getCustomPersonas, getTheories } from '@/lib/supabase/admin'
import { getUserMemories } from '@/lib/supabase/client'
import type { Persona } from '@/lib/types/persona'
import type { MemoryRecord } from '@/lib/types/memory'

export const maxDuration = 60

// 速率限制
const RATE_LIMIT = 15
const WINDOW_MS = 60_000
const rateLimitMap = new Map<string, number[]>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const windowStart = now - WINDOW_MS
  const timestamps = (rateLimitMap.get(userId) ?? []).filter((t) => t > windowStart)
  if (timestamps.length >= RATE_LIMIT) return false
  timestamps.push(now)
  rateLimitMap.set(userId, timestamps)
  return true
}

function buildMemoryContext(memories: MemoryRecord[]): string {
  if (memories.length === 0) return ''
  const lines = memories.map((m) => {
    const c = m.content as Record<string, string>
    switch (m.type) {
      case 'topic': return `- 曾討論過：${c.topic}（${c.detail}）`
      case 'decision': return `- 曾決定：${c.decision}（狀態：${c.outcome}）`
      case 'preference':
        return c.dislike
          ? `- 不喜歡：${c.dislike}（原因：${c.reason}）`
          : `- 喜歡：${c.like}（原因：${c.reason}）`
      case 'milestone': return `- 里程碑：${c.description}`
      default: return ''
    }
  }).filter(Boolean)
  return `\n\n【你對這位用戶的了解】\n${lines.join('\n')}\n`
}

export interface RoundtableMessage {
  id: string
  role: 'user' | 'mentor' | 'synthesizer'
  mentorId?: string
  mentorName?: string
  color?: string
  initial?: string
  content: string
  replyToId?: string
  timestamp: number
}

interface RequestBody {
  messages: RoundtableMessage[]
  mentorIds: string[]
  theoryIds?: string[]
  replyToMentorId?: string
  mentionedMentorIds?: string[]
  synthesize?: boolean
}

// 多 Agent 圓桌對話：每個導師獨立思考，短回應，互相討論
const MAX_TURNS = 6

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 })

  const body: RequestBody = await req.json()
  const { messages, mentorIds, theoryIds, replyToMentorId, mentionedMentorIds, synthesize } = body

  if (!messages || messages.length === 0 || !mentorIds || mentorIds.length < 2) {
    return new Response('需要對話紀錄和至少 2 位導師', { status: 400 })
  }

  // 載入導師
  const customPersonas = await getCustomPersonas()
  const allPersonaMap = new Map<string, Persona>()
  for (const id of mentorIds) {
    const p = PERSONAS[id] ?? customPersonas.find((pp) => pp.id === id)
    if (p) allPersonaMap.set(id, p)
  }

  // 載入記憶 + 理論（如果有指定 theoryIds 就只用選中的）
  const [memories, allTheories] = await Promise.all([
    getUserMemories(userId),
    getTheories(),
  ])
  const theories = theoryIds && theoryIds.length > 0
    ? allTheories.filter((t) => theoryIds.includes(t.id))
    : allTheories
  const memoryContext = buildMemoryContext(memories)
  const theoryContext = theories.length > 0
    ? `\n\n【已加入的思維工具箱】\n${theories.map((t) => `- ${t.name}：${t.coreIdea}\n  如何應用：${t.systemPromptExtension}`).join('\n')}\n\n你可以主動使用這些理論框架來分析問題。如果某個理論和你自己的核心思維互補，嘗試將它們融合在一起，產生更深刻的觀點。例如：你可以結合你的專長和上面的理論，提出獨到的見解。`
    : ''

  // 把歷史對話格式化
  function formatHistory(msgs: RoundtableMessage[]): string {
    return msgs.map((m) => {
      if (m.role === 'user') return `用戶：${m.content}`
      return `${m.mentorName}：${m.content}`
    }).join('\n')
  }

  const history = formatHistory(messages)

  // 其他導師名字列表（給 prompt 用）
  function otherMentorNames(currentId: string): string {
    return [...allPersonaMap.values()]
      .filter((m) => m.id !== currentId)
      .map((m) => m.name)
      .join('、')
  }

  // 決定第一輪發言順序
  let turnOrder: string[]
  if (replyToMentorId) {
    turnOrder = [replyToMentorId, ...mentorIds.filter((id) => id !== replyToMentorId)]
  } else if (mentionedMentorIds && mentionedMentorIds.length > 0) {
    const mentioned = mentionedMentorIds.filter((id) => allPersonaMap.has(id))
    const rest = mentorIds.filter((id) => !mentioned.includes(id))
    turnOrder = [...mentioned, ...rest]
  } else {
    turnOrder = [...mentorIds]
  }

  // 建立最多 2 輪的發言序列
  const fullTurnOrder: string[] = []
  for (let round = 0; round < 2; round++) {
    for (const id of turnOrder) fullTurnOrder.push(id)
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // 本輪新產生的對話
      const thisRoundMsgs: { mentorName: string; text: string }[] = []
      let turnCount = 0
      let consecutiveSkips = 0

      for (let i = 0; i < fullTurnOrder.length; i++) {
        if (turnCount >= MAX_TURNS) break
        // 連續跳過次數 >= 導師數量 → 大家都沒話說了
        if (consecutiveSkips >= mentorIds.length) break

        const mentorId = fullTurnOrder[i]
        const mentor = allPersonaMap.get(mentorId)
        if (!mentor) continue

        const isFirst = thisRoundMsgs.length === 0
        const recentDiscussion = thisRoundMsgs.map((r) => `${r.mentorName}：${r.text}`).join('\n')

        // 圓桌對話 prompt
        const roundtableRules = `
你正在一個圓桌群聊中，和其他導師（${otherMentorNames(mentor.id)}）一起與用戶交談。

對話規則：
- 像群組聊天一樣自然說話，1-3 句話，最多 60 字
- 回應另一個導師 → 用 @導師名 開頭（例如：@費曼 我不同意...）
- 對用戶提問或點名用戶 → 用 @用戶 開頭（例如：@用戶 你當時為什麼停下來？）
- 給出一般性結論或陳述 → 不需要加 @
- 可以同意、反駁、補充、追問其他導師，像真人一樣互動
- 如果前面的討論已經充分表達了你的想法，或你沒有新觀點，只回覆「（跳過）」
- 不要寫長篇大論。你在聊天，不是在寫文章
- 適時用 @用戶 向用戶提出反問，幫助他們思考`

        const systemPrompt = mentor.systemPrompt + memoryContext + theoryContext + roundtableRules

        const prompt = isFirst
          ? `對話紀錄：\n${history}\n\n以 ${mentor.name} 的角度回應用戶最新的發言。`
          : `對話紀錄：\n${history}\n\n本輪討論：\n${recentDiscussion}\n\n以 ${mentor.name} 的角度加入討論。可以回應其他導師，也可以對用戶說話。如果沒有新觀點就跳過。`

        const meta = {
          mentorId: mentor.id,
          mentorName: mentor.name,
          color: mentor.color,
          initial: mentor.initial,
        }

        try {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'step_start', meta })}\n\n`
          ))

          const { text: fullText } = await generateText({
            model: proxy('claude-sonnet-4-6'),
            system: systemPrompt,
            prompt,
            maxOutputTokens: 120,
          })

          const trimmed = fullText.trim()

          // 判斷是否跳過
          if (trimmed === '（跳過）' || trimmed === '（點頭）' || trimmed === '') {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'step_skip', mentorId: mentor.id })}\n\n`
            ))
            consecutiveSkips++
            continue
          }

          // 有實質回應
          consecutiveSkips = 0
          turnCount++

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'step_delta', mentorId: mentor.id, delta: trimmed })}\n\n`
          ))

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'step_done', mentorId: mentor.id })}\n\n`
          ))

          thisRoundMsgs.push({ mentorName: mentor.name, text: trimmed })

        } catch (err) {
          console.error(`[Roundtable] ${mentor.name} 回應失敗:`, err)
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'step_error', meta, error: `${mentor.name}暫時無法回應` })}\n\n`
          ))
        }
      }

      // 主持人總結（只在 synthesize=true 時）
      if (synthesize) {
        const synthMeta = {
          mentorId: '_synthesizer',
          mentorName: '主持人',
          color: '#d97706',
          initial: 'S',
        }

        try {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'synthesis_start', meta: synthMeta })}\n\n`
          ))

          const { text: synthText } = await generateText({
            model: proxy('claude-sonnet-4-6'),
            system: `你是圓桌討論的主持人。綜合所有導師和用戶的對話，找出共識與分歧，給出均衡的建議。
用繁體中文回應，200-300 字。不偏袒任何導師。

在回應最後，用以下格式列出 1-3 個具體可行動建議（每行一個）：
【行動】建議內容
${memoryContext}`,
            prompt: `完整對話紀錄：\n${history}\n\n請綜合以上討論，給出你的總結和建議。`,
            maxOutputTokens: 500,
          })

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'synthesis_delta', mentorId: '_synthesizer', delta: synthText })}\n\n`
          ))

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'synthesis_done', mentorId: '_synthesizer' })}\n\n`
          ))
        } catch (err) {
          console.error('[Roundtable] 主持人總結失敗:', err)
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'synthesis_error' })}\n\n`
          ))
        }
      }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
