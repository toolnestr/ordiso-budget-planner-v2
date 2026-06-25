import { getById, upsertDoc } from '@/lib/firestore'
import { ok, err, serialize, startOfWeek } from '@/lib/api'
import { requireUser } from '@/lib/session'

export const dynamic = 'force-dynamic'

const COLL = 'weeklyCheckins'

export async function GET() {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const ws = startOfWeek()
  const id = `${user.userId}_${ws.toISOString()}`
  let checkin = await getById<Record<string, unknown>>(COLL, id)
  if (!checkin) {
    checkin = await upsertDoc<Record<string, unknown>>(COLL, id, {
      userId: user.userId,
      weekStart: ws.toISOString(),
      loggedReceipts: false,
      paidBills: false,
      reviewedBudget: false,
      reconciledAccounts: false,
      createdAt: new Date().toISOString(),
    })
  }
  return ok(serialize(checkin))
}

export async function PUT(req: Request) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const body = await req.json()
  const ws = startOfWeek()
  const id = `${user.userId}_${ws.toISOString()}`
  const c = await upsertDoc<Record<string, unknown>>(COLL, id, {
    userId: user.userId,
    weekStart: ws.toISOString(),
    loggedReceipts: body.loggedReceipts ?? false,
    paidBills: body.paidBills ?? false,
    reviewedBudget: body.reviewedBudget ?? false,
    reconciledAccounts: body.reconciledAccounts ?? false,
  })
  return ok(serialize(c))
}
