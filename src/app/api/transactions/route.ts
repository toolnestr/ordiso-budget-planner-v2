import { getAll, getWhereMulti, createAuto } from '@/lib/firestore'
import { ok, err, serialize, monthRange } from '@/lib/api'
import type { Transaction, Category, Account } from '@/lib/types'
import type { WhereFilterOp } from 'firebase/firestore'

export const dynamic = 'force-dynamic'

const COLL = 'transactions'

/** Attach category + account snapshots to a list of transactions. */
async function joinRelations(txs: Transaction[]) {
  const cats = await getAll<Category>('categories')
  const accs = await getAll<Account>('accounts')
  const catMap = new Map(cats.map((c) => [c.id, c]))
  const accMap = new Map(accs.map((a) => [a.id, a]))
  return txs.map((t) => ({
    ...serialize(t),
    category: t.categoryId ? catMap.get(t.categoryId) ?? null : null,
    account: t.accountId ? accMap.get(t.accountId) ?? null : null,
  }))
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const month = url.searchParams.get('month')
  const year = url.searchParams.get('year')
  const accountId = url.searchParams.get('accountId')
  const categoryId = url.searchParams.get('categoryId')
  const limit = url.searchParams.get('limit')

  // Build filters. Date range is two filters on the SAME field (allowed).
  const filters: { field: string; op: WhereFilterOp; value: unknown }[] = []
  if (month && year) {
    const { start, end } = monthRange(Number(month), Number(year))
    filters.push({ field: 'date', op: '>=', value: start.toISOString() })
    filters.push({ field: 'date', op: '<', value: end.toISOString() })
  }
  if (accountId) filters.push({ field: 'accountId', op: '==', value: accountId })
  if (categoryId) filters.push({ field: 'categoryId', op: '==', value: categoryId })

  let txs: Transaction[]
  if (filters.length) {
    txs = await getWhereMulti<Transaction>(COLL, filters)
  } else {
    txs = await getAll<Transaction>(COLL)
  }
  // Sort by date desc (client-side; combining where+orderBy on different fields needs a composite index)
  txs.sort((a, b) => (b.date > a.date ? 1 : -1))
  if (limit) txs = txs.slice(0, Number(limit))

  return ok(await joinRelations(txs))
}

export async function POST(req: Request) {
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
    createdAt: new Date().toISOString(),
  })
  return ok(serialize(tx), { status: 201 })
}
