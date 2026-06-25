import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const b = await db.bill.update({
    where: { id },
    data: {
      name: body.name,
      amount: body.amount != null ? Number(body.amount) : undefined,
      frequency: body.frequency,
      dueDay: body.dueDay != null ? Number(body.dueDay) : undefined,
      category: body.category,
      isSubscription: body.isSubscription,
      cancelFlag: body.cancelFlag,
      active: body.active,
      lastPaidDate: body.lastPaidDate != null ? (body.lastPaidDate ? new Date(body.lastPaidDate) : null) : undefined,
    },
  })
  return ok(serialize(b))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.bill.delete({ where: { id } })
  return ok({ success: true })
}
