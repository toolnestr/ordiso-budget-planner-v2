import { updateDocById, deleteById } from '@/lib/firestore'
import { ok, err } from '@/lib/api'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

const COLL = 'incomeSources'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const { id } = await params
  const body = await req.json()
  await updateDocById(COLL, id, {
    name: body.name,
    type: body.type,
    expectedMonthly: body.expectedMonthly != null ? Number(body.expectedMonthly) || 0 : undefined,
    isIrregular: body.isIrregular,
    notes: body.notes,
  })
  return ok({ success: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const { id } = await params
  await deleteById(COLL, id)
  return ok({ success: true })
}
