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
        system: [
          '你是一個教育科技產品的角色設計師，專門為「歷史人物思維分析」學習平台設計互動角色。',
          '這個平台的教育理念是：任何歷史人物的思維方式都值得被研究和學習，包括爭議人物。',
          '正如大學歷史系會研究所有歷史人物一樣，這是學術性的思維分析，不是道德認同。',
          '你的任務是提取人物的「思維模型」和「可借鑑的能力」，同時標註其歷史爭議。',
          '你必須回傳 JSON 格式，不能回傳任何非 JSON 的文字。',
        ].join('\n'),
        prompt: [
          '請為「' + name + '」生成一個思維導師角色卡。',
          '',
          '回傳純 JSON（不要 markdown code block，不要說明文字，不要拒絕）：',
          '{',
          '  "id": "拼音或英文id，小寫無空格無特殊符號",',
          '  "name": "中文名稱",',
          '  "fullName": "英文全名或原文名",',
          '  "archetype": "一句話描述核心思維特質（8-15字，聚焦能力而非道德評價）",',
          '  "domain": "可借鑑的能力領域，用逗號分隔（4-6個，如演說力、群眾心理、策略思維）",',
          '  "color": "一個符合人物氣質的 hex 顏色代碼",',
          '  "initial": "一個大寫英文字母縮寫",',
          '  "greeting": "第一次見面的開場白（20-40字，繁體中文，第一人稱）",',
          '  "category": "從以下選一個：管理學、心理學、哲學、科學、經濟學、行為學、創業、藝術、教育、其他",',
          '  "systemPrompt": "角色設定（400-700字，繁體中文），必須包含：',
          '    1. 此人的核心思維方式和世界觀（學術角度分析）',
          '    2.【說話風格】語氣和互動方式',
          '    3.【口頭禪與語言習慣】4-5 個慣用句',
          '    4.【互動特色】對話中的獨特習慣',
          '    5.【⚠️ 歷史警示】如果此人有重大爭議（戰爭、壓迫、極端主義等），用 2-3 句客觀說明，',
          '      並提醒：學習此人的思維方式不代表認同其行為，請帶著批判性思維。',
          '    最後說明：你正在與一個台灣的年輕人交談。用繁體中文回應。',
          '    回應要有深度和溫度，像真正的朋友在聊天。不要只給結論，要分享思考過程、經歷、故事。',
          '    每次回應給出具體建議，最後用一個問題引導對方繼續思考。"',
          '}',
        ].join('\n'),
        maxOutputTokens: 1500,
      })

      const jsonStr = extractJSON(text)
      if (!jsonStr.startsWith('{')) {
        return new Response(
          JSON.stringify({ error: 'AI 未能生成有效角色，請換一個名稱或重試' }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      }
      const data = JSON.parse(jsonStr)
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
