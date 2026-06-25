import { db } from '@/lib/db'
import { ok, err, serialize, monthRange } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const month = url.searchParams.get('month')
  const year = url.searchParams.get('year')
  const accountId = url.searchParams.get('accountId')
  const categoryId = url.searchParams.get('categoryId')
  const limit = url.searchParams.get('limit')

  const where: Record<string, unknown> = {}
  if (month && year) {
    const { start, end } = monthRange(Number(month), Number(year))
    where.date = { gte: start, lt: end }
  }
  if (accountId) where.accountId = accountId
  if (categoryId) where.categoryId = categoryId

  const txs = await db.transaction.findMany({
    where,
    include: {
      category: true,
      account: true,
    },
    orderBy: { date: 'desc' },
    ...(limit ? { take: Number(limit) } : {}),
  })
  return ok(serialize(txs))
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.description || body.amount == null) return err('Description and amount are required')

  // Support split transactions: body.splits = [{categoryId, amount, ...}]
  if (Array.isArray(body.splits) && body.splits.length > 0) {
    const total = body.splits.reduce((s: number, sp: { amount: number }) => s + Number(sp.amount), 0)
    const parent = await db.transaction.create({
      data: {
        date: body.date ? new Date(body.date) : new Date(),
        description: body.description,
        amount: total,
        type: body.type ?? 'EXPENSE',
        accountId: body.accountId ?? null,
        notes: body.notes ?? null,
        isSplit: true,
        parentTransactionId: null,
      },
      include: { category: true, account: true },
    })
    for (const sp of body.splits) {
      await db.transaction.create({
        data: {
          date: parent.date,
          description: body.description,
          amount: Number(sp.amount),
          type: body.type ?? 'EXPENSE',
          categoryId: sp.categoryId ?? null,
          accountId: body.accountId ?? null,
          notes: sp.note ?? null,
          isSplit: false,
          parentTransactionId: parent.id,
        },
      })
    }
    return ok(serialize(parent), { status: 201 })
  }

  const tx = await db.transaction.create({
    data: {
      date: body.date ? new Date(body.date) : new Date(),
      description: body.description,
      amount: Number(body.amount),
      type: body.type ?? 'EXPENSE',
      categoryId: body.categoryId ?? null,
      accountId: body.accountId ?? null,
      notes: body.notes ?? null,
      isSplit: false,
      parentTransactionId: null,
    },
    include: { category: true, account: true },
  })
  return ok(serialize(tx), { status: 201 })
}
