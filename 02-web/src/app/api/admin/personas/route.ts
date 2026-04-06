import { auth } from '@clerk/nextjs/server'
import { getCustomPersonas, saveCustomPersona, deleteCustomPersona } from '@/lib/supabase/admin'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  const personas = await getCustomPersonas()
  return Response.json(personas)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  const persona = await req.json()
  await saveCustomPersona(persona)
  return Response.json({ ok: true })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  const { id } = await req.json()
  await deleteCustomPersona(id)
  return Response.json({ ok: true })
}
