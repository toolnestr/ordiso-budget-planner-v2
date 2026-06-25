import { getById, upsertDoc } from '@/lib/firestore'
import { ok, err, serialize, startOfWeek } from '@/lib/api'

export const dynamic = 'force-dynamic'

const COLL = 'weeklyCheckins'

export async function GET() {
  const ws = startOfWeek()
  const id = ws.toISOString()
  let checkin = await getById<Record<string, unknown>>(COLL, id)
  if (!checkin) {
    checkin = await upsertDoc<Record<string, unknown>>(COLL, id, {
      weekStart: id,
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
  const body = await req.json()
  const ws = startOfWeek()
  const id = ws.toISOString()
  const c = await upsertDoc<Record<string, unknown>>(COLL, id, {
    weekStart: id,
    loggedReceipts: body.loggedReceipts ?? false,
    paidBills: body.paidBills ?? false,
    reviewedBudget: body.reviewedBudget ?? false,
    reconciledAccounts: body.reconciledAccounts ?? false,
  })
  return ok(serialize(c))
}
