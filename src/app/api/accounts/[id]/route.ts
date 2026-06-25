import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const a = await db.account.update({
    where: { id },
    data: {
      name: body.name,
      type: body.type,
      startingBalance: Number(body.startingBalance) ?? 0,
      color: body.color,
    },
  })
  return ok(serialize(a))
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.account.delete({ where: { id } })
  return ok({ success: true })
}
