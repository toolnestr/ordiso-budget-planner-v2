import { getAll, updateDocById, deleteById, deleteWhere, getById } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import { requireAdmin } from '@/lib/session'

export const dynamic = 'force-dynamic'

interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
  bannedAt?: string | null
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return err('Forbidden', 403)

  const users = await getAll<AdminUser>('users')
  users.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  // Strip hashedPassword from the response
  const safe = users.map(({ id, email, name, role, createdAt, bannedAt }) =>
    serialize({ id, email, name, role, createdAt, bannedAt: bannedAt ?? null, banned: !!bannedAt })
  )
  return ok(safe)
}

// Promote/demote or ban/unban a user. Body: { action: 'promote'|'demote'|'ban'|'unban' }
export async function PUT(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return err('Forbidden', 403)

  const body = await req.json()
  const { id, action } = body as { id: string; action: 'promote' | 'demote' | 'ban' | 'unban' }
  if (!id || !action) return err('id and action are required')

  const target = await getById<AdminUser>('users', id)
  if (!target) return err('User not found', 404)
  if (target.id === admin.userId) return err('You cannot modify your own account', 400)

  if (action === 'promote') await updateDocById('users', id, { role: 'admin', bannedAt: null })
  if (action === 'demote') await updateDocById('users', id, { role: 'user' })
  if (action === 'ban') await updateDocById('users', id, { bannedAt: new Date().toISOString() })
  if (action === 'unban') await updateDocById('users', id, { bannedAt: null })

  return ok({ success: true })
}

// Delete a user and ALL their data across every collection.
export async function DELETE(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return err('Forbidden', 403)

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return err('id query param is required')

  const target = await getById<AdminUser>('users', id)
  if (!target) return err('User not found', 404)
  if (target.id === admin.userId) return err('You cannot delete your own account', 400)

  const collections = ['debtPayments', 'weeklyCheckins', 'bills', 'debts', 'savingsGoals', 'monthlyBudgets', 'transactions', 'incomeSources', 'categories', 'accounts', 'settings']
  for (const c of collections) {
    await deleteWhere(c, 'userId', '==', id)
  }
  await deleteById('users', id)
  return ok({ success: true })
}
