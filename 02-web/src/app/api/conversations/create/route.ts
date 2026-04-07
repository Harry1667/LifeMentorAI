import { auth } from '@clerk/nextjs/server'
import { createSession, updateSessionMessages } from '@/lib/supabase/client'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const { type, mentorIds, messages, title } = await req.json()

  const id = await createSession(userId, type ?? 'chat', mentorIds ?? [], title)

  if (messages && messages.length > 0) {
    await updateSessionMessages(id, messages)
  }

  return Response.json({ id })
}
