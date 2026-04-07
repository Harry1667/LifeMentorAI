import { auth } from '@clerk/nextjs/server'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

export interface ActionRecord {
  id: string
  user_id: string
  advice_text: string
  status: 'accepted' | 'in_progress' | 'rejected' | 'completed'
  progress_pct: number
  rejection_reason: string | null
  mentor_source: string | null
  created_at: string
  updated_at: string
}

// GET — 列出用戶所有行動
export async function GET() {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  try {
    const rows = await sql`
      SELECT * FROM actions
      WHERE user_id = ${userId}
      ORDER BY
        CASE status
          WHEN 'in_progress' THEN 0
          WHEN 'accepted' THEN 1
          WHEN 'completed' THEN 2
          WHEN 'rejected' THEN 3
        END,
        updated_at DESC
    `
    return Response.json(rows)
  } catch (err) {
    console.error('[DB] 行動列表失敗:', err)
    return Response.json([])
  }
}

// POST — 新增行動
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const { adviceText, mentorSource } = await req.json()
  if (!adviceText?.trim()) return new Response('adviceText required', { status: 400 })

  try {
    const rows = await sql`
      INSERT INTO actions (user_id, advice_text, mentor_source, status)
      VALUES (${userId}, ${adviceText}, ${mentorSource ?? null}, 'accepted')
      RETURNING id
    `
    return Response.json({ id: rows[0].id })
  } catch (err) {
    console.error('[DB] 行動新增失敗:', err)
    return new Response('Failed', { status: 500 })
  }
}

// PUT — 更新行動狀態/進度
export async function PUT(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const { id, status, progressPct, rejectionReason } = await req.json()
  if (!id) return new Response('id required', { status: 400 })

  try {
    await sql`
      UPDATE actions SET
        status = COALESCE(${status ?? null}, status),
        progress_pct = COALESCE(${progressPct ?? null}, progress_pct),
        rejection_reason = COALESCE(${rejectionReason ?? null}, rejection_reason)
      WHERE id = ${id} AND user_id = ${userId}
    `
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[DB] 行動更新失敗:', err)
    return new Response('Failed', { status: 500 })
  }
}

// DELETE — 刪除行動
export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const { id } = await req.json()
  if (!id) return new Response('id required', { status: 400 })

  try {
    await sql`DELETE FROM actions WHERE id = ${id} AND user_id = ${userId}`
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[DB] 行動刪除失敗:', err)
    return new Response('Failed', { status: 500 })
  }
}
