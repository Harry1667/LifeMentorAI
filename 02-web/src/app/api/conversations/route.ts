import { auth } from '@clerk/nextjs/server'
import { getConversation, saveConversation } from '@/lib/supabase/client'
import type { UIMessage } from 'ai'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const mentorId = searchParams.get('mentor')
  if (!mentorId) return new Response('mentor required', { status: 400 })

  const messages = await getConversation(userId, mentorId)
  return Response.json(messages)
}

export async function PUT(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const { mentorId, messages }: { mentorId: string; messages: UIMessage[] } = await req.json()
  if (!mentorId) return new Response('mentorId required', { status: 400 })

  await saveConversation(userId, mentorId, messages)
  return Response.json({ ok: true })
}
