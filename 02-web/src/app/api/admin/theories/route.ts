import { auth } from '@clerk/nextjs/server'
import { getTheories, saveTheory, deleteTheory } from '@/lib/supabase/admin'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  const theories = await getTheories()
  return Response.json(theories)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  const theory = await req.json()
  await saveTheory(theory)
  return Response.json({ ok: true })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  const { id } = await req.json()
  await deleteTheory(id)
  return Response.json({ ok: true })
}
