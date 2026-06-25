import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const item = await db.incomeSource.update({
    where: { id },
    data: {
      name: body.name,
      type: body.type,
      expectedMonthly: Number(body.expectedMonthly) || 0,
      isIrregular: body.isIrregular,
      notes: body.notes,
    },
  })
  return ok(serialize(item))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.incomeSource.delete({ where: { id } })
  return ok({ success: true })
}
