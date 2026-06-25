import { getWhere, createAuto } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import { requireUser } from '@/lib/session'
import type { Debt, DebtPayment } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'debts'
const PAY_COLL = 'debtPayments'

async function joinPayments(userId: string, debts: (Debt & { userId?: string })[]) {
  const owned = debts.filter((d) => d.userId === userId)
  return Promise.all(
    owned.map(async (d) => {
      const payments = await getWhere<DebtPayment>(PAY_COLL, 'debtId', '==', d.id)
      const ownedPayments = payments.filter((p) => p.userId === userId)
      ownedPayments.sort((a, b) => (b.date > a.date ? 1 : -1))
      return { ...serialize(d), payments: ownedPayments.slice(0, 6) }
    })
  )
}

export async function GET() {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const debts = await getWhere<Debt & { userId?: string }>(COLL, 'userId', '==', user.userId)
  debts.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  return ok(await joinPayments(user.userId, debts))
}

export async function POST(req: Request) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const body = await req.json()
  if (!body.name) return err('Name is required')
  const all = await getWhere<Debt>(COLL, 'userId', '==', user.userId)
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
    userId: user.userId,
    createdAt: new Date().toISOString(),
  })
  return ok(serialize(d), { status: 201 })
}
