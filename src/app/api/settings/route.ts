import { db } from '@/lib/db'
import { ok, err, serialize } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  let s = await db.settings.findUnique({ where: { id: 'singleton' } })
  if (!s) {
    s = await db.settings.create({ data: { id: 'singleton' } })
  }
  return ok(serialize(s))
}

export async function PUT(req: Request) {
  const body = await req.json()
  const s = await db.settings.upsert({
    where: { id: 'singleton' },
    update: {
      currencySymbol: body.currencySymbol,
      currencyCode: body.currencyCode,
      cashEnvelopeMode: body.cashEnvelopeMode,
      weeklyCheckinDay: body.weeklyCheckinDay,
      setupComplete: body.setupComplete,
      plannerName: body.plannerName,
    },
    create: { id: 'singleton', ...body },
  })
  return ok(serialize(s))
}
