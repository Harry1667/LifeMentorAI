import { auth } from '@clerk/nextjs/server'
import { getCustomPersonas, saveCustomPersona, deleteCustomPersona } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-check'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  const personas = await getCustomPersonas()
  return Response.json(personas)
}

export async function POST(req: Request) {
  const deny = await requireAdmin()
  if (deny) return deny
  const persona = await req.json()
  await saveCustomPersona(persona)
  return Response.json({ ok: true })
}

export async function DELETE(req: Request) {
  const deny = await requireAdmin()
  if (deny) return deny
  const { id } = await req.json()
  await deleteCustomPersona(id)
  return Response.json({ ok: true })
}
