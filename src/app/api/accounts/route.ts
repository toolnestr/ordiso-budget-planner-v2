import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

async function computeBalance(accountId: string, startingBalance: number) {
  const txs = await db.transaction.findMany({ where: { accountId } })
  const sum = txs.reduce((acc, t) => acc + (t.type === 'INCOME' ? t.amount : t.type === 'EXPENSE' ? -t.amount : 0), 0)
  return startingBalance + sum
}

export async function GET() {
  const accounts = await db.account.findMany({ orderBy: { createdAt: 'asc' } })
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
  const a = await db.account.create({
    data: {
      name: body.name,
      type: body.type ?? 'CHECKING',
      startingBalance: Number(body.startingBalance) || 0,
      color: body.color ?? 'emerald',
    },
  })
  return ok(serialize(a), { status: 201 })
}
