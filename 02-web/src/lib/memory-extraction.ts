import { generateText } from 'ai'
import { proxy } from '@/lib/ai-proxy'
import type { Memory } from '@/lib/types/memory'

interface ExtractedMemory {
  content: Memory
  type: Memory['type']
  importance: number
}

/**
 * 從對話中提取用戶的重要資訊，存入記憶系統
 * 這是第二個 API 呼叫（在導師回應之後）
 */
export async function extractMemories(
  userMessage: string,
  assistantReply: string
): Promise<ExtractedMemory[]> {
  const prompt = `你是記憶提取助理。所有欄位值必須用繁體中文撰寫。

對話內容：
用戶：${userMessage}
導師：${assistantReply}

任務：提取用戶透露的重要個人資訊（最多 3 條）。沒有值得記憶的內容就回傳 []。

類型與 content 格式：
- topic → {"topic":"話題名","detail":"細節描述"}
- decision → {"decision":"決定內容","outcome":"accepted|rejected|in_progress"}
- preference → {"like":"喜歡的事","reason":"原因"} 或 {"dislike":"不喜歡的事","reason":"原因"}
- milestone → {"description":"成就描述","date":"日期或空字串"}

重要性評分：10=核心價值觀 8=長期偏好 5=具體決定 3=短暫話題 1=瑣碎細節

直接回傳 JSON 陣列，不要 markdown，不要解釋：
[{"type":"類型","content":{...},"importance":數字}]`

  try {
    const { text } = await generateText({
      model: proxy('claude-haiku-4-5'),
      prompt,
      maxOutputTokens: 500,
    })

    const parsed = JSON.parse(text.trim())

    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (item) =>
        item.type && item.content && typeof item.importance === 'number'
    ) as ExtractedMemory[]
  } catch (err) {
    console.error('[MemoryExtraction] 提取失敗:', err)
    return []
  }
}
