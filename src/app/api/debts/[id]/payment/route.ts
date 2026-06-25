import { getById, createAuto, updateDocById, getWhere } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import { requireUser } from '@/lib/session'
import type { Debt, DebtPayment } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'debts'
const PAY_COLL = 'debtPayments'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const { id } = await params
  const body = await req.json()
  const amount = Number(body.amount)
  if (!amount || amount <= 0) return err('Amount must be positive')

  const debt = await getById<Debt & { userId?: string }>(COLL, id)
  if (!debt || debt.userId !== user.userId) return err('Not found', 404)

  const payment = await createAuto<DebtPayment>(PAY_COLL, {
    debtId: id,
    date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
    amount,
    note: body.note ?? null,
    userId: user.userId,
    createdAt: new Date().toISOString(),
  })

  let newBalance = (debt.currentBalance ?? 0) - amount
  let paidOff = false
  if (newBalance <= 0) {
    newBalance = 0
    paidOff = true
  }
  await updateDocById<Debt>(COLL, id, { currentBalance: newBalance, paidOff })

  const payments = await getWhere<DebtPayment>(PAY_COLL, 'debtId', '==', id)
  payments.sort((a, b) => (b.date > a.date ? 1 : -1))

  return ok(serialize({
    payment,
    debt: { ...debt, currentBalance: newBalance, paidOff, payments: payments.slice(0, 6) },
  }))
}
