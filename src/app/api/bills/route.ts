import { getAll, createAuto } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import type { Bill } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'bills'

export async function GET() {
  const bills = await getAll<Bill>(COLL)
  // Sort: active first, then name asc (client-side)
  bills.sort((a, b) => Number(b.active ?? true) - Number(a.active ?? true) || (a.name ?? '').localeCompare(b.name ?? ''))
  return ok(serialize(bills))
}

export async function POST(req: Request) {
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
    createdAt: new Date().toISOString(),
  })
  return ok(serialize(b), { status: 201 })
}
