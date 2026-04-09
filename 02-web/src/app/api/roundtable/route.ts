import { auth } from '@clerk/nextjs/server'
import { generateText } from 'ai'
import { proxy } from '@/lib/ai-proxy'
import { PERSONAS } from '@/lib/personas'
import { getCustomPersonas, getTheories, getRecentContext } from '@/lib/supabase/admin'
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 每輪最多 3 人發言，硬性停止
const MAX_SPEAKERS_PER_ROUND = 3

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

  // 載入記憶 + 理論 + 近期行動
  const userMsgCount = messages.filter((m) => m.role === 'user').length
  const [memories, allTheories, recentContext] = await Promise.all([
    getUserMemories(userId),
    getTheories(),
    userMsgCount <= 1 ? getRecentContext(userId) : Promise.resolve(''),
  ])
  const theories = theoryIds && theoryIds.length > 0
    ? allTheories.filter((t) => theoryIds.includes(t.id))
    : allTheories
  const memoryContext = buildMemoryContext(memories)
  const theoryContext = theories.length > 0
    ? `\n\n【已加入的思維工具箱】\n${theories.map((t) => `- ${t.name}：${t.coreIdea}\n  如何應用：${t.systemPromptExtension}`).join('\n')}\n\n你可以主動使用這些理論框架來分析問題。將它們融合在你自己的思維中，產生更深刻的觀點。`
    : ''

  // 歷史對話格式化
  function formatHistory(msgs: RoundtableMessage[]): string {
    return msgs.map((m) => {
      if (m.role === 'user') return `用戶：${m.content}`
      return `${m.mentorName}：${m.content}`
    }).join('\n')
  }

  const history = formatHistory(messages)

  function otherMentorNames(currentId: string): string {
    return [...allPersonaMap.values()]
      .filter((m) => m.id !== currentId)
      .map((m) => m.name)
      .join('、')
  }

  // 決定發言順序：被 @ 的排前面，其餘隨機
  let turnOrder: string[]
  if (replyToMentorId) {
    turnOrder = [replyToMentorId, ...shuffle(mentorIds.filter((id) => id !== replyToMentorId))]
  } else if (mentionedMentorIds && mentionedMentorIds.length > 0) {
    const mentioned = mentionedMentorIds.filter((id) => allPersonaMap.has(id))
    const rest = shuffle(mentorIds.filter((id) => !mentioned.includes(id)))
    turnOrder = [...mentioned, ...rest]
  } else {
    turnOrder = shuffle([...mentorIds])
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const thisRoundMsgs: { mentorName: string; text: string }[] = []
      let speakerCount = 0

      for (const mentorId of turnOrder) {
        if (speakerCount >= MAX_SPEAKERS_PER_ROUND) break

        const mentor = allPersonaMap.get(mentorId)
        if (!mentor) continue

        const others = otherMentorNames(mentor.id)
        const recentDiscussion = thisRoundMsgs.map((r) => `${r.mentorName}：${r.text}`).join('\n')

        // 最後一位發言者必須問用戶問題
        const isLastSpeaker = speakerCount === MAX_SPEAKERS_PER_ROUND - 1
        const roundtableRules = [
          '',
          `你正在一個圓桌群聊中，和其他導師（${others}）一起跟用戶聊天。`,
          '你們是一群真正的朋友在認真討論一個問題。',
          '',
          '回應方式：',
          '- 說出你真正的想法，不要敷衍。分享你的經歷、故事、具體案例。',
          '- 如果你同意前面某人的觀點，說出你同意的原因，並補充新的角度。',
          '- 如果你不同意，直接用 @導師名 反駁，說出你的理由。',
          '- 不要重複別人已經說過的話。如果沒新東西要說，回覆「（跳過）」。',
          '',
          '禁止：',
          '- 不要寫一句話就結束。你是在跟朋友聊天，不是在寫格言。',
          '- 不要空泛的心靈雞湯（「做自己就好」「相信自己」這種廢話不要說）。',
          '- 不要解釋你的思考過程。',
          '',
          isLastSpeaker
            ? '【最重要的指令】你是這輪最後一位發言者。分享你的觀點後，你的回應必須以 @用戶 開頭的問題結尾。問一個具體、有深度的問題，根據討論內容追問用戶的真實情況。例如：「@用戶 你剛才提到...，我想問你...？」這個問題會讓討論暫停，等用戶回答後再繼續。'
            : '',
        ].filter(Boolean).join('\n')

        const systemPrompt = mentor.systemPrompt + memoryContext + theoryContext + recentContext + roundtableRules

        const prompt = thisRoundMsgs.length === 0
          ? `對話紀錄：\n${history}\n\n以 ${mentor.name} 的身分，針對用戶的問題分享你的看法。要具體、有深度，用你自己的經歷或故事來說明。`
          : `對話紀錄：\n${history}\n\n本輪討論：\n${recentDiscussion}\n\n以 ${mentor.name} 的身分加入討論。回應前面導師的觀點（同意、反駁、補充都可以），不要重複已經說過的話。`

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
            maxOutputTokens: 300,
          })

          const trimmed = fullText.trim()

          if (trimmed === '（跳過）' || trimmed === '（點頭）' || trimmed === '') {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'step_skip', mentorId: mentor.id })}\n\n`
            ))
            continue
          }

          speakerCount++

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'step_delta', mentorId: mentor.id, delta: trimmed })}\n\n`
          ))

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'step_done', mentorId: mentor.id })}\n\n`
          ))

          thisRoundMsgs.push({ mentorName: mentor.name, text: trimmed })

          // @用戶 提問 → 立刻停，後面的人不用說了
          if (trimmed.includes('@用戶') && (trimmed.includes('？') || trimmed.includes('?'))) {
            break
          }

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
