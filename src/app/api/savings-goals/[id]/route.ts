import { getById, updateDocById, deleteById } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import { requireUser } from '@/lib/session'
import type { SavingsGoal } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'savingsGoals'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const { id } = await params
  const body = await req.json()

  // Verify ownership
  const existing = await getById<SavingsGoal & { userId?: string }>(COLL, id)
  if (!existing || existing.userId !== user.userId) return err('Not found', 404)

  // Contribution: add to savedAmount
  if (body.addAmount != null) {
    const newSaved = (existing.savedAmount ?? 0) + Number(body.addAmount)
    await updateDocById<SavingsGoal>(COLL, id, { savedAmount: newSaved })
    const g = await getById<SavingsGoal>(COLL, id)
    return ok(serialize(g))
  }

  await updateDocById<SavingsGoal>(COLL, id, {
    name: body.name,
    targetAmount: body.targetAmount != null ? Number(body.targetAmount) : undefined,
    savedAmount: body.savedAmount != null ? Number(body.savedAmount) : undefined,
    targetDate: body.targetDate != null ? (body.targetDate ? new Date(body.targetDate).toISOString() : null) : undefined,
    color: body.color,
    icon: body.icon,
  })
  const g = await getById<SavingsGoal>(COLL, id)
  return ok(serialize(g))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const { id } = await params
  const existing = await getById<SavingsGoal & { userId?: string }>(COLL, id)
  if (!existing || existing.userId !== user.userId) return err('Not found', 404)
  await deleteById(COLL, id)
  return ok({ success: true })
}
