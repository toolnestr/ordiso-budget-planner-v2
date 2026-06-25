import { getWhere, createAuto } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import { requireUser } from '@/lib/session'
import type { Bill } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'bills'

export async function GET() {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const bills = await getWhere<Bill>(COLL, 'userId', '==', user.userId)
  bills.sort((a, b) => Number(b.active ?? true) - Number(a.active ?? true) || (a.name ?? '').localeCompare(b.name ?? ''))
  return ok(serialize(bills))
}

export async function POST(req: Request) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const body = await req.json()
  if (!body.name) return err('Name is required')
  const b = await createAuto<Bill>(COLL, {
    name: body.name,
    amount: Number(body.amount) || 0,
    frequency: body.frequency ?? 'MONTHLY',
    dueDay: Number(body.dueDay) || 1,
    category: body.category ?? null,
    isSubscription: body.isSubscription ?? false,
    cancelFlag: body.cancelFlag ?? false,
    active: body.active ?? true,
    lastPaidDate: body.lastPaidDate ? new Date(body.lastPaidDate).toISOString() : null,
    userId: user.userId,
    createdAt: new Date().toISOString(),
  })
  return ok(serialize(b), { status: 201 })
}
