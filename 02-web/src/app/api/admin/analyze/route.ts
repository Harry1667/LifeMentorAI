import { generateText } from 'ai'
import { proxy } from '@/lib/ai-proxy'
import { requireAdmin } from '@/lib/admin-check'

function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) return match[1].trim()
  return text.trim()
}

export async function POST(req: Request) {
  const deny = await requireAdmin()
  if (deny) return deny

  const { type, name } = await req.json()

  try {
    if (type === 'mentor') {
      const { text } = await generateText({
        model: proxy('claude-sonnet-4-6'),
        prompt: `你是一個 AI 導師系統的設計師。請根據「${name}」這個歷史人物或思想家，生成一個 AI 導師角色設定。

回傳純 JSON（不要 markdown code block，不要任何說明文字）：
{
  "id": "拼音或英文id，小寫無空格無特殊符號",
  "name": "中文名稱",
  "fullName": "英文全名或原文名",
  "archetype": "一句話描述這個導師的核心特質（8-15字）",
  "domain": "擅長領域，用逗號分隔（4-6個）",
  "color": "一個符合人物氣質的 hex 顏色代碼",
  "initial": "一個大寫英文字母縮寫",
  "greeting": "第一次見面的開場白（20-40字，繁體中文，第一人稱，自然親切）",
  "category": "從以下選一個最合適的分類：管理學、心理學、哲學、科學、經濟學、行為學、創業、藝術、教育、其他",
  "systemPrompt": "詳細的角色設定（400-700字，繁體中文），必須包含以下區塊：\n1. 核心世界觀和思維方式\n2.【說話風格】具體描述這個人的語氣（例如：溫和、犀利、幽默、沉穩），用什麼方式和人互動\n3.【口頭禪與語言習慣】列出 4-5 個這個人會說的口頭禪或慣用句（用引號括起來），讓 AI 在對話中自然使用\n4.【互動特色】描述這個人在對話中的獨特習慣（例如：喜歡反問、會突然舉例、先共感再建議）\n最後一段說明：你正在與台灣大學生或年輕工作者交談，用繁體中文回應，每次150-250字，給出具體可行的建議。"
}`,
        maxOutputTokens: 1500,
      })

      const data = JSON.parse(extractJSON(text))
      return Response.json(data)
    }

    if (type === 'theory') {
      const { text } = await generateText({
        model: proxy('claude-sonnet-4-6'),
        prompt: `你是一個知識體系設計師。請根據「${name}」這個理論、方法論或哲學框架，生成結構化描述。

回傳純 JSON（不要 markdown code block，不要任何說明文字）：
{
  "name": "理論名稱（繁體中文）",
  "coreIdea": "核心思想，一段話說明這個理論在解決什麼問題（60-100字）",
  "keyPrinciples": ["原則一（20-30字）", "原則二", "原則三", "原則四"],
  "application": "最適合在什麼情境下使用這個理論（30-50字）",
  "category": "從以下選一個最合適的分類：管理學、心理學、哲學、科學、經濟學、行為學、創業、藝術、教育、其他",
  "systemPromptExtension": "給 AI 導師的補充指令（100-150字），說明如何在對話中自然融入這個理論的思維框架，幫助用戶"
}`,
        maxOutputTokens: 800,
      })

      const data = JSON.parse(extractJSON(text))
      return Response.json(data)
    }

    return new Response('Invalid type', { status: 400 })
  } catch (err) {
    console.error('[Admin Analyze] 失敗:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
