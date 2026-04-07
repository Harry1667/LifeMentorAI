import { auth } from '@clerk/nextjs/server'
import { listSessions } from '@/lib/supabase/client'
import { PERSONAS } from '@/lib/personas'
import { getCustomPersonas } from '@/lib/supabase/admin'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const sessions = await listSessions(userId)
  const customPersonas = await getCustomPersonas()

  const allPersonas: Record<string, { name: string; color: string; initial: string }> = {}
  for (const [id, p] of Object.entries(PERSONAS)) {
    allPersonas[id] = { name: p.name, color: p.color, initial: p.initial }
  }
  for (const p of customPersonas) {
    allPersonas[p.id] = { name: p.name, color: p.color, initial: p.initial }
  }

  const summaries = sessions.map((s) => {
    const mentorInfos = (s.mentor_ids ?? []).map((id: string) => allPersonas[id]).filter(Boolean)

    // 取第一條用戶訊息作為 preview
    let preview = s.title ?? '新對話'
    const msgs = s.messages as Array<{ role?: string; content?: string; parts?: Array<{ type: string; text?: string }> }>
    if (msgs.length > 0) {
      const firstUser = msgs.find((m) => m.role === 'user')
      if (firstUser) {
        // 支援 UIMessage（parts）和 RoundtableMessage（content）兩種格式
        if (firstUser.parts) {
          const textPart = firstUser.parts.find((p) => p.type === 'text')
          if (textPart?.text) preview = textPart.text.slice(0, 40)
        } else if (firstUser.content) {
          preview = firstUser.content.slice(0, 40)
        }
      }
    }

    return {
      id: s.id,
      type: s.type,
      title: preview,
      mentors: mentorInfos,
      updatedAt: s.updated_at,
    }
  })

  return Response.json(summaries)
}
