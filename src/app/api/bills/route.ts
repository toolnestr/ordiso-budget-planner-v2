import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const bills = await db.bill.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] })
  return ok(serialize(bills))
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.name) return err('Name is required')
  const b = await db.bill.create({
    data: {
      name: body.name,
      amount: Number(body.amount) || 0,
      frequency: body.frequency ?? 'MONTHLY',
      dueDay: Number(body.dueDay) || 1,
      category: body.category ?? null,
      isSubscription: body.isSubscription ?? false,
      cancelFlag: body.cancelFlag ?? false,
      active: body.active ?? true,
      lastPaidDate: body.lastPaidDate ? new Date(body.lastPaidDate) : null,
    },
  })
  return ok(serialize(b), { status: 201 })
}
