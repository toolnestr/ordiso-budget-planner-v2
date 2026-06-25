import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const tx = await db.transaction.update({
    where: { id },
    data: {
      date: body.date ? new Date(body.date) : undefined,
      description: body.description,
      amount: body.amount != null ? Number(body.amount) : undefined,
      type: body.type,
      categoryId: body.categoryId,
      accountId: body.accountId,
      notes: body.notes,
      isReconciled: body.isReconciled,
    },
    include: { category: true, account: true },
  })
  return ok(serialize(tx))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Delete child split transactions too
  await db.transaction.deleteMany({ where: { parentTransactionId: id } })
  await db.transaction.delete({ where: { id } })
  return ok({ success: true })
}
