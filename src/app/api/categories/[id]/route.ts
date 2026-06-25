import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const c = await db.category.update({
    where: { id },
    data: {
      name: body.name,
      type: body.type,
      group: body.group,
      color: body.color,
      icon: body.icon,
      rollover: body.rollover,
    },
  })
  return ok(serialize(c))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Unlink transactions first, then delete
  await db.transaction.updateMany({ where: { categoryId: id }, data: { categoryId: null } })
  await db.monthlyBudget.deleteMany({ where: { categoryId: id } })
  await db.category.delete({ where: { id } })
  return ok({ success: true })
}
