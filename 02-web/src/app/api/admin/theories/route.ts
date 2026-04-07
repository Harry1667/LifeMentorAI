import { auth } from '@clerk/nextjs/server'
import { getTheories, saveTheory, deleteTheory } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/admin-check'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  const theories = await getTheories()
  return Response.json(theories)
}

export async function POST(req: Request) {
  const deny = await requireAdmin()
  if (deny) return deny
  const theory = await req.json()
  await saveTheory(theory)
  return Response.json({ ok: true })
}

export async function DELETE(req: Request) {
  const deny = await requireAdmin()
  if (deny) return deny
  const { id } = await req.json()
  await deleteTheory(id)
  return Response.json({ ok: true })
}
