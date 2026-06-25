import { getWhere, createAuto } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import { requireUser } from '@/lib/session'
import type { Category } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'categories'

export async function GET() {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const cats = await getWhere<Category>(COLL, 'userId', '==', user.userId)
  cats.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''))
  return ok(serialize(cats))
}

export async function POST(req: Request) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const body = await req.json()
  if (!body.name) return err('Name is required')
  const all = await getWhere<Category>(COLL, 'userId', '==', user.userId)
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
    userId: user.userId,
  })
  return ok(serialize(c), { status: 201 })
}
