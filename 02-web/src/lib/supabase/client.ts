import { createClient } from '@supabase/supabase-js'
import type { MemoryRecord } from '@/lib/types/memory'

// 使用 Service Role Key（伺服器端專用，不暴露給客戶端）
// 連線字串必須是 Transaction Mode Pooler，不是直接連線
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * 讀取用戶記憶
 * 按 importance DESC, updated_at DESC 排序，LIMIT 20
 */
export async function getUserMemories(userId: string): Promise<MemoryRecord[]> {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('user_id', userId)
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[Supabase] 記憶讀取失敗:', error.message)
    return []
  }

  return data as MemoryRecord[]
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

  const records = memories.map((m) => ({
    user_id: userId,
    type: m.type,
    content: m.content,
    importance: m.importance,
  }))

  const { error } = await supabase.from('memories').insert(records)

  if (error) {
    console.error('[Supabase] 記憶寫入失敗:', error.message)
    // 靜默失敗，不拋錯
  }
}
