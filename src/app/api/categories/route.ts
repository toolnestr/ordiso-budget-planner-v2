import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cats = await db.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  return ok(serialize(cats))
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.name) return err('Name is required')
  const maxOrder = await db.category.aggregate({ _max: { sortOrder: true } })
  const c = await db.category.create({
    data: {
      name: body.name,
      type: body.type ?? 'EXPENSE',
      group: body.group ?? 'VARIABLE',
      color: body.color ?? 'emerald',
      icon: body.icon ?? '📁',
      rollover: body.rollover ?? false,
      sortOrder: body.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
      isSystem: false,
    },
  })
  return ok(serialize(c), { status: 201 })
}
