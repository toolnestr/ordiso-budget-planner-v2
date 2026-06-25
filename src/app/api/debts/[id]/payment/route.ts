import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

// Record a debt payment — reduces currentBalance and logs the payment
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const amount = Number(body.amount)
  if (!amount || amount <= 0) return err('Amount must be positive')

  const payment = await db.debtPayment.create({
    data: {
      debtId: id,
      date: body.date ? new Date(body.date) : new Date(),
      amount,
      note: body.note ?? null,
    },
  })

  const debt = await db.debt.update({
    where: { id },
    data: {
      currentBalance: { decrement: amount },
      paidOff: false,
    },
    include: { payments: { orderBy: { date: 'desc' }, take: 6 } },
  })

  // If balance hit zero or below, mark paid off and clamp
  if (debt.currentBalance <= 0) {
    await db.debt.update({ where: { id }, data: { currentBalance: 0, paidOff: true } })
    debt.currentBalance = 0
    debt.paidOff = true
  }

  return ok(serialize({ payment, debt }))
}
