import { getById, upsertDoc } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import { requireUser } from '@/lib/session'
import type { Settings } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'settings'

function settingsDocId(userId: string) {
  return `singleton_${userId}`
}

const DEFAULTS: Settings = {
  id: 'singleton',
  currencySymbol: '$',
  currencyCode: 'USD',
  cashEnvelopeMode: false,
  weeklyCheckinDay: 0,
  setupComplete: false,
  plannerName: 'FinFlow Planner',
}

export async function GET() {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const id = settingsDocId(user.userId)
  let s = await getById<Settings>(COLL, id)
  if (!s) {
    s = await upsertDoc<Settings>(COLL, id, { ...DEFAULTS, userId: user.userId })
  }
  return ok(serialize(s))
}

export async function PUT(req: Request) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const body = await req.json()
  const id = settingsDocId(user.userId)
  const s = await upsertDoc<Partial<Settings> & { userId: string }>(COLL, id, {
    userId: user.userId,
    currencySymbol: body.currencySymbol,
    currencyCode: body.currencyCode,
    cashEnvelopeMode: body.cashEnvelopeMode,
    weeklyCheckinDay: body.weeklyCheckinDay,
    setupComplete: body.setupComplete,
    plannerName: body.plannerName,
  })
  return ok(serialize(s))
}
