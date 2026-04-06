import postgres from 'postgres'
import type { MemoryRecord } from '@/lib/types/memory'

// Serverless 環境每次 function call 都可能建新連線，max: 1 避免連線耗盡
const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

/**
 * 讀取用戶記憶
 * 按 importance DESC, updated_at DESC 排序，LIMIT 20
 */
export async function getUserMemories(userId: string): Promise<MemoryRecord[]> {
  try {
    const rows = await sql<MemoryRecord[]>`
      SELECT id, user_id, type, content, importance, created_at, updated_at
      FROM memories
      WHERE user_id = ${userId}
      ORDER BY importance DESC, updated_at DESC
      LIMIT 20
    `
    return rows
  } catch (err) {
    console.error('[DB] 記憶讀取失敗:', err)
    return []
  }
}

/**
 * 寫入新記憶
 * 失敗時靜默（不阻塞對話）
 */
export async function saveMemories(
  userId: string,
  memories: Array<{ content: object; type: string; importance: number }>
): Promise<void> {
  if (memories.length === 0) return

  try {
    const records = memories.map((m) => ({
      user_id: userId,
      type: m.type,
      content: JSON.stringify(m.content),
      importance: m.importance,
    }))

    for (const r of records) {
      await sql`
        INSERT INTO memories (user_id, type, content, importance)
        VALUES (${r.user_id}, ${r.type}, ${r.content}::jsonb, ${r.importance})
      `
    }
  } catch (err) {
    console.error('[DB] 記憶寫入失敗:', err)
    // 靜默失敗，不拋錯
  }
}
