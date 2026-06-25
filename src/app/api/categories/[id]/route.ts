import { updateDocById, deleteById, updateWhere, deleteWhere } from '@/lib/firestore'
import { ok } from '@/lib/api'

export const dynamic = 'force-dynamic'

const COLL = 'categories'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  await updateDocById(COLL, id, {
    name: body.name,
    type: body.type,
    group: body.group,
    color: body.color,
    icon: body.icon,
    rollover: body.rollover,
  })
  return ok({ success: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Unlink transactions (set categoryId to null), delete budgets, then the category
  await updateWhere('transactions', [{ field: 'categoryId', op: '==', value: id }], { categoryId: null })
  await deleteWhere('monthlyBudgets', 'categoryId', '==', id)
  await deleteById(COLL, id)
  return ok({ success: true })
}
