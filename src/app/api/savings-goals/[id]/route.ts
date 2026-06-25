import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // If body.addAmount is provided, add to savedAmount (contribution)
  if (body.addAmount != null) {
    const g = await db.savingsGoal.update({
      where: { id },
      data: { savedAmount: { increment: Number(body.addAmount) } },
    })
    return ok(serialize(g))
  }

  const g = await db.savingsGoal.update({
    where: { id },
    data: {
      name: body.name,
      targetAmount: body.targetAmount != null ? Number(body.targetAmount) : undefined,
      savedAmount: body.savedAmount != null ? Number(body.savedAmount) : undefined,
      targetDate: body.targetDate != null ? (body.targetDate ? new Date(body.targetDate) : null) : undefined,
      color: body.color,
      icon: body.icon,
    },
  })
  return ok(serialize(g))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.savingsGoal.delete({ where: { id } })
  return ok({ success: true })
}
