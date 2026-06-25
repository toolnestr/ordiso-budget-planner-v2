import { getWhere, createAuto } from '@/lib/firestore'
import { ok, err, serialize, monthRange } from '@/lib/api'
import { requireUser } from '@/lib/session'
import type { Transaction, Category, Account } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'transactions'

/** Attach category + account snapshots to a list of transactions. */
async function joinRelations(userId: string, txs: Transaction[]) {
  const cats = await getWhere<Category>('categories', 'userId', '==', userId)
  const accs = await getWhere<Account>('accounts', 'userId', '==', userId)
  const catMap = new Map(cats.map((c) => [c.id, c]))
  const accMap = new Map(accs.map((a) => [a.id, a]))
  return txs.map((t) => ({
    ...serialize(t),
    category: t.categoryId ? catMap.get(t.categoryId) ?? null : null,
    account: t.accountId ? accMap.get(t.accountId) ?? null : null,
  }))
}

export async function GET(req: Request) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const month = url.searchParams.get('month')
  const year = url.searchParams.get('year')
  const accountId = url.searchParams.get('accountId')
  const categoryId = url.searchParams.get('categoryId')
  const limit = url.searchParams.get('limit')

  // Fetch by userId only (single-field, no composite index), filter in memory.
  let txs = await getWhere<Transaction>(COLL, 'userId', '==', user.userId)
  if (month && year) {
    const { start, end } = monthRange(Number(month), Number(year))
    txs = txs.filter((t) => {
      const d = new Date(t.date)
      return d >= start && d < end
    })
  }
  if (accountId) txs = txs.filter((t) => t.accountId === accountId)
  if (categoryId) txs = txs.filter((t) => t.categoryId === categoryId)
  txs.sort((a, b) => (b.date > a.date ? 1 : -1))
  if (limit) txs = txs.slice(0, Number(limit))

  return ok(await joinRelations(user.userId, txs))
}

export async function POST(req: Request) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const body = await req.json()
  if (!body.description || body.amount == null) return err('Description and amount are required')
  const dateIso = body.date ? new Date(body.date).toISOString() : new Date().toISOString()

  // Split transactions
  if (Array.isArray(body.splits) && body.splits.length > 0) {
    const total = body.splits.reduce((s: number, sp: { amount: number }) => s + Number(sp.amount), 0)
    const parent = await createAuto<Transaction>(COLL, {
      date: dateIso,
      description: body.description,
      amount: total,
      type: body.type ?? 'EXPENSE',
      categoryId: null,
      accountId: body.accountId ?? null,
      notes: body.notes ?? null,
      isSplit: true,
      parentTransactionId: null,
      isReconciled: false,
      userId: user.userId,
      createdAt: new Date().toISOString(),
    })
    for (const sp of body.splits) {
      await createAuto<Transaction>(COLL, {
        date: dateIso,
        description: body.description,
        amount: Number(sp.amount),
        type: body.type ?? 'EXPENSE',
        categoryId: sp.categoryId ?? null,
        accountId: body.accountId ?? null,
        notes: sp.note ?? null,
        isSplit: false,
        parentTransactionId: parent.id,
        isReconciled: false,
        userId: user.userId,
        createdAt: new Date().toISOString(),
      })
    }
    return ok(serialize(parent), { status: 201 })
  }

  const tx = await createAuto<Transaction>(COLL, {
    date: dateIso,
    description: body.description,
    amount: Number(body.amount),
    type: body.type ?? 'EXPENSE',
    categoryId: body.categoryId ?? null,
    accountId: body.accountId ?? null,
    notes: body.notes ?? null,
    isSplit: false,
    parentTransactionId: null,
    isReconciled: false,
    userId: user.userId,
    createdAt: new Date().toISOString(),
  })
  return ok(serialize(tx), { status: 201 })
}
