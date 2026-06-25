import { updateDocById, deleteById, updateWhere, deleteWhere } from '@/lib/firestore'
import { ok, err } from '@/lib/api'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

const COLL = 'categories'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
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
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const { id } = await params
  // Unlink this user's transactions, delete their budgets for the category, then the category
  await updateWhere('transactions', [
    { field: 'userId', op: '==', value: user.userId },
    { field: 'categoryId', op: '==', value: id },
  ], { categoryId: null })
  await deleteWhere('monthlyBudgets', 'categoryId', '==', id)
  await deleteById(COLL, id)
  return ok({ success: true })
}
