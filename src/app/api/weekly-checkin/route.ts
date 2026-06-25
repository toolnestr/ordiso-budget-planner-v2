import { db } from '@/lib/db'
import { ok, err, serialize, startOfWeek } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ws = startOfWeek()
  let checkin = await db.weeklyCheckin.findUnique({ where: { weekStart: ws } })
  if (!checkin) {
    checkin = await db.weeklyCheckin.create({ data: { weekStart: ws } })
  }
  return ok(serialize(checkin))
}

export async function PUT(req: Request) {
  const body = await req.json()
  const ws = startOfWeek()
  const c = await db.weeklyCheckin.upsert({
    where: { weekStart: ws },
    update: {
      loggedReceipts: body.loggedReceipts,
      paidBills: body.paidBills,
      reviewedBudget: body.reviewedBudget,
      reconciledAccounts: body.reconciledAccounts,
    },
    create: {
      weekStart: ws,
      loggedReceipts: body.loggedReceipts ?? false,
      paidBills: body.paidBills ?? false,
      reviewedBudget: body.reviewedBudget ?? false,
      reconciledAccounts: body.reconciledAccounts ?? false,
    },
  })
  return ok(serialize(c))
}
