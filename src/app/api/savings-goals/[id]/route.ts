import { getById, updateDocById, deleteById } from '@/lib/firestore'
import { ok, serialize } from '@/lib/api'
import type { SavingsGoal } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'savingsGoals'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // Contribution: add to savedAmount
  if (body.addAmount != null) {
    const current = await getById<SavingsGoal>(COLL, id)
    if (!current) return ok({ success: false })
    const newSaved = (current.savedAmount ?? 0) + Number(body.addAmount)
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
  const { id } = await params
  await deleteById(COLL, id)
  return ok({ success: true })
}
