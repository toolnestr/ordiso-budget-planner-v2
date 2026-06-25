import { getById, updateDocById, deleteById, deleteWhere } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import { requireUser } from '@/lib/session'
import type { Transaction, Category, Account } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'transactions'

async function joinOne(userId: string, tx: Transaction) {
  const cat = tx.categoryId ? await getById<Category>('categories', tx.categoryId) : null
  const acc = tx.accountId ? await getById<Account>('accounts', tx.accountId) : null
  return { ...serialize(tx), category: cat, account: acc }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const { id } = await params

  const existing = await getById<Transaction & { userId?: string }>(COLL, id)
  if (!existing || existing.userId !== user.userId) return err('Not found', 404)

  const body = await req.json()
  await updateDocById<Transaction>(COLL, id, {
    date: body.date ? new Date(body.date).toISOString() : undefined,
    description: body.description,
    amount: body.amount != null ? Number(body.amount) : undefined,
    type: body.type,
    categoryId: body.categoryId,
    accountId: body.accountId,
    notes: body.notes,
    isReconciled: body.isReconciled,
  })
  const tx = await getById<Transaction>(COLL, id)
  if (!tx) return ok({ success: true })
  return ok(await joinOne(user.userId, tx))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const { id } = await params
  const existing = await getById<Transaction & { userId?: string }>(COLL, id)
  if (!existing || existing.userId !== user.userId) return err('Not found', 404)
  await deleteWhere(COLL, 'parentTransactionId', '==', id)
  await deleteById(COLL, id)
  return ok({ success: true })
}
