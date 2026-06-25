import { getById, upsertDoc } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import type { Settings } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'settings'
const ID = 'singleton'

const DEFAULTS: Settings = {
  id: ID,
  currencySymbol: '$',
  currencyCode: 'USD',
  cashEnvelopeMode: false,
  weeklyCheckinDay: 0,
  setupComplete: false,
  plannerName: 'FinFlow Planner',
}

export async function GET() {
  let s = await getById<Settings>(COLL, ID)
  if (!s) {
    s = await upsertDoc<Settings>(COLL, ID, DEFAULTS)
  }
  return ok(serialize(s))
}

export async function PUT(req: Request) {
  const body = await req.json()
  const s = await upsertDoc<Partial<Settings>>(COLL, ID, {
    currencySymbol: body.currencySymbol,
    currencyCode: body.currencyCode,
    cashEnvelopeMode: body.cashEnvelopeMode,
    weeklyCheckinDay: body.weeklyCheckinDay,
    setupComplete: body.setupComplete,
    plannerName: body.plannerName,
  })
  return ok(serialize(s))
}
