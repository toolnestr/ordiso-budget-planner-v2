import { updateDocById, deleteById, deleteWhere } from '@/lib/firestore'
import { ok, err } from '@/lib/api'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

const COLL = 'accounts'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const { id } = await params
  const body = await req.json()
  await updateDocById(COLL, id, {
    name: body.name,
    type: body.type,
    startingBalance: body.startingBalance != null ? Number(body.startingBalance) : undefined,
    color: body.color,
  })
  return ok({ success: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const { id } = await params
  // Delete the account and unlink its transactions
  await deleteWhere('transactions', 'accountId', '==', id)
  await deleteById(COLL, id)
  return ok({ success: true })
}
