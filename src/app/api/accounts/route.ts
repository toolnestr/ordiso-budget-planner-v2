import { getWhere, createAuto } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import { requireUser } from '@/lib/session'
import type { Account, Transaction } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'accounts'
const TX_COLL = 'transactions'

async function computeBalance(userId: string, accountId: string, startingBalance: number) {
  const txs = await getWhere<Transaction>(TX_COLL, 'accountId', '==', accountId)
  // double-filter by userId for safety even though accountId is user-scoped
  const sum = txs.filter((t) => t.userId === userId).reduce((acc, t) => acc + (t.type === 'INCOME' ? t.amount : t.type === 'EXPENSE' ? -t.amount : 0), 0)
  return startingBalance + sum
}

export async function GET() {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const accounts = await getWhere<Account>(COLL, 'userId', '==', user.userId)
  accounts.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
  const withBalance = await Promise.all(
    accounts.map(async (a) => ({
      ...serialize(a),
      currentBalance: await computeBalance(user.userId, a.id, a.startingBalance),
    }))
  )
  return ok(withBalance)
}

export async function POST(req: Request) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const body = await req.json()
  if (!body.name) return err('Name is required')
  const a = await createAuto<Account>(COLL, {
    name: body.name,
    type: body.type ?? 'CHECKING',
    startingBalance: Number(body.startingBalance) || 0,
    color: body.color ?? 'emerald',
    userId: user.userId,
    createdAt: new Date().toISOString(),
  })
  return ok(serialize(a), { status: 201 })
}
