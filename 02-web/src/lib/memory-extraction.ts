import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
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
  const prompt = `你是一個記憶提取助理。從以下對話中，提取用戶透露的重要個人資訊。

對話內容：
用戶：${userMessage}
導師回應：${assistantReply}

請提取以下類型的資訊（如果有的話）：
- topic：用戶提到的困境或話題
- decision：用戶做的決定或接受/拒絕的建議
- preference：用戶的偏好或不喜歡的事情
- milestone：用戶提到的成就或重要事件

對於每條記憶，評估重要性（1-10）：
- 10：核心價值觀/長期人格特質
- 8：長期偏好（不喜歡某種學習方式）
- 5：具體決定（決定用番茄鐘）
- 3：短暫情緒/一次性話題
- 1：無關緊要的細節

只提取真正有價值的資訊，最多 3 條。如果沒有值得記憶的內容，回傳空陣列。

回傳 JSON 格式（不要 markdown code block）：
[
  {
    "type": "topic|decision|preference|milestone",
    "content": { ...對應型別的欄位 },
    "importance": 數字
  }
]`

  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
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
