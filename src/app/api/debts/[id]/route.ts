import { getById, updateDocById, deleteById, deleteWhere, getWhere } from '@/lib/firestore'
import { ok, serialize } from '@/lib/api'
import type { Debt, DebtPayment } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'debts'
const PAY_COLL = 'debtPayments'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  await updateDocById<Debt>(COLL, id, {
    name: body.name,
    creditor: body.creditor,
    currentBalance: body.currentBalance != null ? Number(body.currentBalance) : undefined,
    originalBalance: body.originalBalance != null ? Number(body.originalBalance) : undefined,
    interestRate: body.interestRate != null ? Number(body.interestRate) : undefined,
    minimumPayment: body.minimumPayment != null ? Number(body.minimumPayment) : undefined,
    strategy: body.strategy,
    paidOff: body.paidOff,
  })
  const d = await getById<Debt>(COLL, id)
  if (!d) return ok({ success: true })
  const payments = await getWhere<DebtPayment>(PAY_COLL, 'debtId', '==', id)
  payments.sort((a, b) => (b.date > a.date ? 1 : -1))
  return ok(serialize({ ...d, payments: payments.slice(0, 6) }))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteWhere(PAY_COLL, 'debtId', '==', id)
  await deleteById(COLL, id)
  return ok({ success: true })
}
