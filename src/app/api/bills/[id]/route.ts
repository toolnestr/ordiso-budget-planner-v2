import { updateDocById, deleteById } from '@/lib/firestore'
import { ok, err } from '@/lib/api'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

const COLL = 'bills'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const { id } = await params
  const body = await req.json()
  await updateDocById(COLL, id, {
    name: body.name,
    amount: body.amount != null ? Number(body.amount) : undefined,
    frequency: body.frequency,
    dueDay: body.dueDay != null ? Number(body.dueDay) : undefined,
    category: body.category,
    isSubscription: body.isSubscription,
    cancelFlag: body.cancelFlag,
    active: body.active,
    lastPaidDate: body.lastPaidDate != null ? (body.lastPaidDate ? new Date(body.lastPaidDate).toISOString() : null) : undefined,
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
