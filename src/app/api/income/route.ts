import { getWhere, createAuto } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import { requireUser } from '@/lib/session'
import type { IncomeSource } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'incomeSources'

export async function GET() {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const items = await getWhere<IncomeSource>(COLL, 'userId', '==', user.userId)
  items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  return ok(serialize(items))
}

export async function POST(req: Request) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const body = await req.json()
  if (!body.name) return err('Name is required')
  const all = await getWhere<IncomeSource>(COLL, 'userId', '==', user.userId)
  const maxOrder = all.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), 0)
  const item = await createAuto<IncomeSource>(COLL, {
    name: body.name,
    type: body.type ?? 'PRIMARY',
    expectedMonthly: Number(body.expectedMonthly) || 0,
    isIrregular: body.isIrregular ?? false,
    notes: body.notes ?? null,
    sortOrder: body.sortOrder ?? maxOrder + 1,
    userId: user.userId,
    createdAt: new Date().toISOString(),
  })
  return ok(serialize(item), { status: 201 })
}
