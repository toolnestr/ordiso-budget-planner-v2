import { getAll, createAuto } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import type { SavingsGoal } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'savingsGoals'

export async function GET() {
  const goals = await getAll<SavingsGoal>(COLL, { orderByField: 'sortOrder', orderDir: 'asc' })
  return ok(serialize(goals))
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.name) return err('Name is required')
  const all = await getAll<SavingsGoal>(COLL)
  const maxOrder = all.reduce((m, g) => Math.max(m, g.sortOrder ?? 0), 0)
  const g = await createAuto<SavingsGoal>(COLL, {
    name: body.name,
    targetAmount: Number(body.targetAmount) || 0,
    savedAmount: Number(body.savedAmount) || 0,
    targetDate: body.targetDate ? new Date(body.targetDate).toISOString() : null,
    color: body.color ?? 'emerald',
    icon: body.icon ?? '🎯',
    sortOrder: body.sortOrder ?? maxOrder + 1,
    createdAt: new Date().toISOString(),
  })
  return ok(serialize(g), { status: 201 })
}
