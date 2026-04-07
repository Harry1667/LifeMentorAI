import { auth } from '@clerk/nextjs/server'
import { deleteSession } from '@/lib/supabase/client'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const { sessionId } = await req.json()
  if (!sessionId) return new Response('sessionId required', { status: 400 })

  const deleted = await deleteSession(sessionId, userId)
  return Response.json({ ok: deleted })
}
