import { getAll, getWhere, createAuto } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import type { Debt, DebtPayment } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'debts'
const PAY_COLL = 'debtPayments'

/** Attach recent payments to each debt. */
async function joinPayments(debts: Debt[]) {
  return Promise.all(
    debts.map(async (d) => {
      const payments = await getWhere<DebtPayment>(PAY_COLL, 'debtId', '==', d.id)
      payments.sort((a, b) => (b.date > a.date ? 1 : -1))
      return { ...serialize(d), payments: payments.slice(0, 6) }
    })
  )
}

export async function GET() {
  const debts = await getAll<Debt>(COLL, { orderByField: 'sortOrder', orderDir: 'asc' })
  return ok(await joinPayments(debts))
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.name) return err('Name is required')
  const all = await getAll<Debt>(COLL)
  const maxOrder = all.reduce((m, d) => Math.max(m, d.sortOrder ?? 0), 0)
  const d = await createAuto<Debt>(COLL, {
    name: body.name,
    creditor: body.creditor ?? null,
    currentBalance: Number(body.currentBalance) || 0,
    originalBalance: Number(body.originalBalance ?? body.currentBalance) || 0,
    interestRate: Number(body.interestRate) || 0,
    minimumPayment: Number(body.minimumPayment) || 0,
    strategy: body.strategy ?? 'SNOWBALL',
    sortOrder: body.sortOrder ?? maxOrder + 1,
    paidOff: false,
    createdAt: new Date().toISOString(),
  })
  return ok(serialize(d), { status: 201 })
}
