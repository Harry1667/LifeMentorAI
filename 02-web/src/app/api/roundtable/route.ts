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

// 第一輪最多幾位導師發言（即使選了更多人，只取前 N 位）
const MAX_SPEAKERS_ROUND1 = 3
// 第二輪最多幾人回應（避免太冗長）
const MAX_DEBATERS_ROUND2 = 2

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
  // 只載入用戶選中的理論（沒選就不帶）
  const theories = theoryIds && theoryIds.length > 0
    ? allTheories.filter((t) => theoryIds.includes(t.id))
    : []
  const memoryContext = buildMemoryContext(memories)
  const theoryContext = theories.length > 0
    ? `\n\n【已加入的思維工具箱——你必須使用】\n${theories.map((t) => `- ${t.name}：${t.coreIdea}\n  如何應用：${t.systemPromptExtension}`).join('\n')}\n\n重要：用戶特別選了這些理論框架。你必須在回應中自然地運用至少一個理論來分析問題。不要只提理論名稱，要實際用它來推導出具體的洞見。`
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

  // 移除回應尾部直接向用戶提問的行（第一輪強制用）
  // 按單一 \n 切行，從尾部往前遞迴截，直到最後一行不是問句
  function stripTrailingUserQuestion(text: string): string {
    const lines = text.split(/\n/)
    if (lines.length <= 1) {
      // 單行情況：如果整段是問句且不是 @ 開頭，整段截掉沒意義，保留
      return text
    }

    // 從尾部往前刪，直到最後一行不含問號或是 @導師 開頭
    while (lines.length > 1) {
      const lastLine = lines[lines.length - 1].trim()
      // 空行直接刪
      if (lastLine === '') {
        lines.pop()
        continue
      }
      const hasQuestion = lastLine.includes('？') || lastLine.includes('?')
      const isMentorDirected = lastLine.startsWith('@')
      if (hasQuestion && !isMentorDirected) {
        lines.pop()
      } else {
        break
      }
    }

    return lines.join('\n').trim()
  }

  // 發送一位導師的回應，回傳文字（null 表示跳過或失敗）
  async function emitMentorTurn(
    controller: ReadableStreamDefaultController,
    encoder: TextEncoder,
    mentor: Persona,
    systemPrompt: string,
    prompt: string,
    options?: { stripUserQuestion?: boolean },
  ): Promise<string | null> {
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
        maxOutputTokens: 600,
      })

      let trimmed = fullText.trim()

      if (trimmed === '（跳過）' || trimmed === '（點頭）' || trimmed === '') {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: 'step_skip', mentorId: mentor.id })}\n\n`
        ))
        return null
      }

      // 第一輪：強制移除尾部的用戶提問
      if (options?.stripUserQuestion) {
        trimmed = stripTrailingUserQuestion(trimmed)
      }

      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'step_delta', mentorId: mentor.id, delta: trimmed })}\n\n`
      ))
      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'step_done', mentorId: mentor.id })}\n\n`
      ))

      return trimmed
    } catch (err) {
      console.error(`[Roundtable] ${mentor.name} 回應失敗:`, err)
      controller.enqueue(encoder.encode(
        `data: ${JSON.stringify({ type: 'step_error', meta, error: `${mentor.name}暫時無法回應` })}\n\n`
      ))
      return null
    }
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const allDiscussion: { mentorId: string; mentorName: string; text: string }[] = []
      let stopped = false
      let round1Speakers = 0

      // ============ 第一輪：每位導師各自表態（最多 MAX_SPEAKERS_ROUND1 人）============
      for (const mentorId of turnOrder) {
        if (stopped) break
        if (round1Speakers >= MAX_SPEAKERS_ROUND1) break
        const mentor = allPersonaMap.get(mentorId)
        if (!mentor) continue

        const others = otherMentorNames(mentor.id)
        const recentDiscussion = allDiscussion.map((r) => `${r.mentorName}：${r.text}`).join('\n')

        const round1Rules = [
          '',
          `你正在一個圓桌群聊中，和其他導師（${others}）一起跟用戶聊天。`,
          '你們是一群真正的朋友在認真討論一個問題。',
          '',
          '【第一輪：分享你的觀點】',
          '- 說出你真正的想法，不要敷衍。分享你的經歷、故事、具體案例。',
          '- 如果前面有人說了，你可以簡短回應他們，但重點是提出你自己的獨特觀點。',
          '- 不要重複別人已經說過的話。如果沒新東西要說，回覆「（跳過）」。',
          '',
          '【嚴格禁止】這一輪絕對不要向用戶提問。不要用問號結尾的句子來詢問用戶。',
          '你的回應應該以陳述句結束（你的觀點、建議、或故事的結論），而不是問句。',
          '後面會有專門的辯論輪，那時候才適合提問。現在只管表達你的立場。',
          '',
          '禁止：',
          '- 不要寫一句話就結束。你是在跟朋友聊天，不是在寫格言。',
          '- 不要空泛的心靈雞湯（「做自己就好」「相信自己」這種廢話不要說）。',
          '- 不要解釋你的思考過程。',
        ].join('\n')

        const systemPrompt = mentor.systemPrompt + memoryContext + theoryContext + recentContext + round1Rules

        const prompt = allDiscussion.length === 0
          ? `對話紀錄：\n${history}\n\n以 ${mentor.name} 的身分，針對用戶的問題分享你的看法。要具體、有深度，用你自己的經歷或故事來說明。`
          : `對話紀錄：\n${history}\n\n目前討論：\n${recentDiscussion}\n\n以 ${mentor.name} 的身分加入討論。提出你自己的觀點，可以簡短回應前面的人，但重點是你獨特的角度。`

        const text = await emitMentorTurn(controller, encoder, mentor, systemPrompt, prompt, { stripUserQuestion: true })
        if (text) {
          allDiscussion.push({ mentorId: mentor.id, mentorName: mentor.name, text })
          round1Speakers++
          // 如果導師不聽話還是問了 @用戶，尊重它
          if (text.includes('@用戶') && (text.includes('？') || text.includes('?'))) {
            stopped = true
          }
        }
      }

      // ============ 第二輪：互相辯論 + 最後一人綜合 ============
      if (!stopped && allDiscussion.length >= 2) {
        // 第二輪：優先從第一輪沒發言過的人選；如果不夠就從第一輪發言過的人裡挑
        const round1SpeakerIds = new Set(allDiscussion.map((d) => d.mentorId))
        const notSpoken = mentorIds.filter((id) => !round1SpeakerIds.has(id))
        const spoken = mentorIds.filter((id) => round1SpeakerIds.has(id))
        const round2Pool = [...shuffle(notSpoken), ...shuffle(spoken)]
        const round2Order = round2Pool.slice(0, MAX_DEBATERS_ROUND2)
        let debateCount = 0

        for (const mentorId of round2Order) {
          const mentor = allPersonaMap.get(mentorId)
          if (!mentor) continue

          const others = otherMentorNames(mentor.id)
          const fullDiscussion = allDiscussion.map((r) => `${r.mentorName}：${r.text}`).join('\n')
          const isCloser = debateCount === round2Order.length - 1 // 最後一位結辯者

          const round2Rules = [
            '',
            `你正在一個圓桌群聊中，和其他導師（${others}）一起跟用戶聊天。`,
            '',
            '【第二輪：辯論與回應】',
            '- 現在所有人都表態完了。這是你回應其他導師的機會。',
            '- 用 @導師名 直接回應你同意或不同意的觀點。要具體，不要「我同意」就結束。',
            '- 可以融合其他導師的觀點，提出更完整的看法。',
            '- 可以指出別人的盲點或補充他們漏掉的面向。',
            '',
            isCloser
              ? [
                  '【最重要的指令】你是這次討論的最後一位發言者。你需要做兩件事：',
                  '1. 回應其他導師的觀點，提出你的綜合看法。可以融合多位導師的想法，給出更完整的建議。',
                  '2. 最後用 @用戶 問一個具體、有深度的問題，讓用戶回應。例如：「@用戶 聽完我們的討論，你覺得...？」',
                ].join('\n')
              : [
                  '- 不要向用戶提問，把討論焦點放在其他導師的觀點上。',
                  '- 大膽地反駁或挑戰其他導師的觀點！用 @導師名 直接點名反駁。',
                  '- 你的回應要以陳述句結束，不要以問號結尾的句子詢問用戶。',
                ].join('\n'),
            '',
            '禁止：',
            '- 不要重複第一輪自己說過的話。',
            '- 不要空泛的總結（「每個人都有道理」這種話不要說）。',
          ].join('\n')

          const systemPrompt = mentor.systemPrompt + memoryContext + theoryContext + recentContext + round2Rules

          const prompt = `對話紀錄：\n${history}\n\n本次圓桌討論：\n${fullDiscussion}\n\n以 ${mentor.name} 的身分回應其他導師的觀點。${isCloser ? '你是最後一位發言者，綜合大家的討論後，用 @用戶 問一個問題。' : '直接回應你認同或不認同的觀點。'}`

          const text = await emitMentorTurn(controller, encoder, mentor, systemPrompt, prompt)
          if (text) {
            allDiscussion.push({ mentorId: mentor.id, mentorName: mentor.name, text })
            debateCount++
            if (text.includes('@用戶') && (text.includes('？') || text.includes('?'))) {
              break
            }
            // 結辯者結束後沒問 @用戶 → 後端強制補一個追問訊息
            if (isCloser) {
              const followupMeta = {
                mentorId: mentor.id,
                mentorName: mentor.name,
                color: mentor.color,
                initial: mentor.initial,
              }
              const followupPrompt = `根據前面的圓桌討論，以 ${mentor.name} 的身分，用一句話以 @用戶 開頭問一個具體、有深度的問題，讓用戶回應。例如：「@用戶 聽完我們的討論，你覺得...？」直接輸出那一句問題就好，不要其他內容。\n\n本次討論內容：\n${allDiscussion.map((r) => `${r.mentorName}：${r.text}`).join('\n')}`
              try {
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'step_start', meta: followupMeta })}\n\n`
                ))
                const { text: followupText } = await generateText({
                  model: proxy('claude-sonnet-4-6'),
                  system: mentor.systemPrompt,
                  prompt: followupPrompt,
                  maxOutputTokens: 150,
                })
                let q = followupText.trim()
                // 確保以 @用戶 開頭
                if (!q.startsWith('@用戶')) q = `@用戶 ${q}`
                // 確保有問號
                if (!q.includes('？') && !q.includes('?')) q += '？'
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'step_delta', mentorId: mentor.id, delta: q })}\n\n`
                ))
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'step_done', mentorId: mentor.id })}\n\n`
                ))
              } catch (err) {
                console.error('[Roundtable] 強制追問失敗:', err)
              }
              break
            }
          }
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
