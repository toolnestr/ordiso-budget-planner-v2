import { getAll, getWhere, createAuto } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import type { Account, Transaction } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'accounts'
const TX_COLL = 'transactions'

async function computeBalance(accountId: string, startingBalance: number) {
  const txs = await getWhere<Transaction>(TX_COLL, 'accountId', '==', accountId)
  const sum = txs.reduce((acc, t) => acc + (t.type === 'INCOME' ? t.amount : t.type === 'EXPENSE' ? -t.amount : 0), 0)
  return startingBalance + sum
}

export async function GET() {
  const accounts = await getAll<Account>(COLL, { orderByField: 'createdAt', orderDir: 'asc' })
  const withBalance = await Promise.all(
    accounts.map(async (a) => ({
      ...serialize(a),
      currentBalance: await computeBalance(a.id, a.startingBalance),
    }))
  )
  return ok(withBalance)
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.name) return err('Name is required')
  const a = await createAuto<Account>(COLL, {
    name: body.name,
    type: body.type ?? 'CHECKING',
    startingBalance: Number(body.startingBalance) || 0,
    color: body.color ?? 'emerald',
    createdAt: new Date().toISOString(),
  })
  return ok(serialize(a), { status: 201 })
}
