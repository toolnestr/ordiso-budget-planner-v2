import { getAll, createAuto } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import type { IncomeSource } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'incomeSources'

export async function GET() {
  const items = await getAll<IncomeSource>(COLL, { orderByField: 'sortOrder', orderDir: 'asc' })
  return ok(serialize(items))
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.name) return err('Name is required')
  const all = await getAll<IncomeSource>(COLL)
  const maxOrder = all.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), 0)
  const item = await createAuto<IncomeSource>(COLL, {
    name: body.name,
    type: body.type ?? 'PRIMARY',
    expectedMonthly: Number(body.expectedMonthly) || 0,
    isIrregular: body.isIrregular ?? false,
    notes: body.notes ?? null,
    sortOrder: body.sortOrder ?? maxOrder + 1,
    createdAt: new Date().toISOString(),
  })
  return ok(serialize(item), { status: 201 })
}
