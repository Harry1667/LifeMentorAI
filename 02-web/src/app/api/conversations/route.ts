import { auth } from '@clerk/nextjs/server'
import { getSession, updateSessionMessages } from '@/lib/supabase/client'

// GET /api/conversations?sessionId=xxx → 取得 session 訊息
export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return Response.json([])

  const session = await getSession(sessionId)
  if (!session || session.user_id !== userId) return Response.json([])
  return Response.json(session.messages)
}

// PUT /api/conversations → 更新 session 訊息
export async function PUT(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const { sessionId, messages, title } = await req.json()
  if (!sessionId) return new Response('sessionId required', { status: 400 })

  await updateSessionMessages(sessionId, messages, title)
  return Response.json({ ok: true })
}
