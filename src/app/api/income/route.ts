import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const items = await db.incomeSource.findMany({ orderBy: { sortOrder: 'asc' } })
  return ok(serialize(items))
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.name) return err('Name is required')
  const maxOrder = await db.incomeSource.aggregate({ _max: { sortOrder: true } })
  const item = await db.incomeSource.create({
    data: {
      name: body.name,
      type: body.type ?? 'PRIMARY',
      expectedMonthly: Number(body.expectedMonthly) || 0,
      isIrregular: body.isIrregular ?? false,
      notes: body.notes ?? null,
      sortOrder: body.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
    },
  })
  return ok(serialize(item), { status: 201 })
}
