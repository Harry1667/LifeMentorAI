import { auth } from '@clerk/nextjs/server'
import { PERSONAS } from '@/lib/personas'
import { getCustomPersonas } from '@/lib/supabase/admin'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const custom = await getCustomPersonas()
  const merged = { ...PERSONAS }
  for (const p of custom) {
    merged[p.id] = p
  }
  return Response.json(Object.values(merged))
}
