import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const debts = await db.debt.findMany({ orderBy: { sortOrder: 'asc' }, include: { payments: { orderBy: { date: 'desc' } } } })
  return ok(serialize(debts))
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.name) return err('Name is required')
  const maxOrder = await db.debt.aggregate({ _max: { sortOrder: true } })
  const d = await db.debt.create({
    data: {
      name: body.name,
      creditor: body.creditor ?? null,
      currentBalance: Number(body.currentBalance) || 0,
      originalBalance: Number(body.originalBalance ?? body.currentBalance) || 0,
      interestRate: Number(body.interestRate) || 0,
      minimumPayment: Number(body.minimumPayment) || 0,
      strategy: body.strategy ?? 'SNOWBALL',
      sortOrder: body.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
    },
  })
  return ok(serialize(d), { status: 201 })
}
