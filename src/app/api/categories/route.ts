import { getAll, createAuto } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import type { Category } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'categories'

export async function GET() {
  const cats = await getAll<Category>(COLL)
  // Order by sortOrder asc then name asc (client-side sort to avoid composite index)
  cats.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''))
  return ok(serialize(cats))
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.name) return err('Name is required')
  const all = await getAll<Category>(COLL)
  const maxOrder = all.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), 0)
  const c = await createAuto<Category>(COLL, {
    name: body.name,
    type: body.type ?? 'EXPENSE',
    group: body.group ?? 'VARIABLE',
    color: body.color ?? 'emerald',
    icon: body.icon ?? '📁',
    rollover: body.rollover ?? false,
    sortOrder: body.sortOrder ?? maxOrder + 1,
    isSystem: false,
  })
  return ok(serialize(c), { status: 201 })
}
