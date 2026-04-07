import postgres from 'postgres'
import type { MemoryRecord } from '@/lib/types/memory'

// Serverless 環境每次 function call 都可能建新連線，max: 1 避免連線耗盡
const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

// ===== 記憶 =====

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

export async function saveMemories(
  userId: string,
  memories: Array<{ content: object; type: string; importance: number }>
): Promise<void> {
  if (memories.length === 0) return
  try {
    for (const m of memories) {
      await sql`
        INSERT INTO memories (user_id, type, content, importance)
        VALUES (${userId}, ${m.type}, ${JSON.stringify(m.content)}::jsonb, ${m.importance})
      `
    }
  } catch (err) {
    console.error('[DB] 記憶寫入失敗:', err)
  }
}

// ===== 對話 Session（統一管理 chat + roundtable） =====

export interface ChatSession {
  id: string
  user_id: string
  type: 'chat' | 'roundtable'
  title: string | null
  mentor_ids: string[]
  messages: unknown[]
  created_at: string
  updated_at: string
}

/** 取得單一 session */
export async function getSession(sessionId: string): Promise<ChatSession | null> {
  try {
    const rows = await sql`
      SELECT id, user_id, type, title, mentor_ids, messages, created_at, updated_at
      FROM chat_sessions WHERE id = ${sessionId}
    `
    if (rows.length === 0) return null
    const r = rows[0]
    return {
      id: r.id,
      user_id: r.user_id,
      type: r.type as 'chat' | 'roundtable',
      title: r.title,
      mentor_ids: typeof r.mentor_ids === 'string' ? JSON.parse(r.mentor_ids) : r.mentor_ids,
      messages: typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages,
      created_at: r.created_at,
      updated_at: r.updated_at,
    } as ChatSession
  } catch (err) {
    console.error('[DB] Session 讀取失敗:', err)
    return null
  }
}

/** 建立新 session，回傳 id */
export async function createSession(
  userId: string,
  type: 'chat' | 'roundtable',
  mentorIds: string[],
  title?: string,
): Promise<string> {
  const rows = await sql`
    INSERT INTO chat_sessions (user_id, type, title, mentor_ids)
    VALUES (${userId}, ${type}, ${title ?? null}, ${JSON.stringify(mentorIds)}::jsonb)
    RETURNING id
  `
  return rows[0].id
}

/** 更新 session 訊息 */
export async function updateSessionMessages(
  sessionId: string,
  messages: unknown[],
  title?: string,
): Promise<void> {
  try {
    if (title) {
      await sql`
        UPDATE chat_sessions
        SET messages = ${JSON.stringify(messages)}::jsonb, title = ${title}, updated_at = NOW()
        WHERE id = ${sessionId}
      `
    } else {
      await sql`
        UPDATE chat_sessions
        SET messages = ${JSON.stringify(messages)}::jsonb, updated_at = NOW()
        WHERE id = ${sessionId}
      `
    }
  } catch (err) {
    console.error('[DB] Session 更新失敗:', err)
  }
}

/** 列出用戶所有 session（摘要） */
export async function listSessions(userId: string): Promise<ChatSession[]> {
  try {
    const rows = await sql`
      SELECT id, user_id, type, title, mentor_ids, messages, created_at, updated_at
      FROM chat_sessions
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
      LIMIT 50
    `
    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      type: r.type as 'chat' | 'roundtable',
      title: r.title,
      mentor_ids: typeof r.mentor_ids === 'string' ? JSON.parse(r.mentor_ids) : r.mentor_ids,
      messages: typeof r.messages === 'string' ? JSON.parse(r.messages) : r.messages,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })) as ChatSession[]
  } catch (err) {
    console.error('[DB] Session 列表失敗:', err)
    return []
  }
}

/** 刪除 session */
export async function deleteSession(sessionId: string, userId: string): Promise<boolean> {
  try {
    const result = await sql`
      DELETE FROM chat_sessions WHERE id = ${sessionId} AND user_id = ${userId}
    `
    return result.count > 0
  } catch (err) {
    console.error('[DB] Session 刪除失敗:', err)
    return false
  }
}
