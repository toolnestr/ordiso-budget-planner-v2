import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const d = await db.debt.update({
    where: { id },
    data: {
      name: body.name,
      creditor: body.creditor,
      currentBalance: body.currentBalance != null ? Number(body.currentBalance) : undefined,
      originalBalance: body.originalBalance != null ? Number(body.originalBalance) : undefined,
      interestRate: body.interestRate != null ? Number(body.interestRate) : undefined,
      minimumPayment: body.minimumPayment != null ? Number(body.minimumPayment) : undefined,
      strategy: body.strategy,
      paidOff: body.paidOff,
    },
    include: { payments: { orderBy: { date: 'desc' }, take: 6 } },
  })
  return ok(serialize(d))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.debt.delete({ where: { id } })
  return ok({ success: true })
}
