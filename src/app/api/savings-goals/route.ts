import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const goals = await db.savingsGoal.findMany({ orderBy: { sortOrder: 'asc' } })
  return ok(serialize(goals))
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.name) return err('Name is required')
  const maxOrder = await db.savingsGoal.aggregate({ _max: { sortOrder: true } })
  const g = await db.savingsGoal.create({
    data: {
      name: body.name,
      targetAmount: Number(body.targetAmount) || 0,
      savedAmount: Number(body.savedAmount) || 0,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
      color: body.color ?? 'emerald',
      icon: body.icon ?? '🎯',
      sortOrder: body.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
    },
  })
  return ok(serialize(g), { status: 201 })
}
