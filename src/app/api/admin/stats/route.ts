import { getAll, countAll } from '@/lib/firestore'
import { ok, err, serialize } from '@/lib/api'
import { requireAdmin } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return err('Forbidden', 403)

  const [users, accounts, transactions, categories, savingsGoals, debts, bills] = await Promise.all([
    getAll('users'),
    countAll('accounts'),
    countAll('transactions'),
    countAll('categories'),
    countAll('savingsGoals'),
    countAll('debts'),
    countAll('bills'),
  ])

  const banned = users.filter((u) => (u as { bannedAt?: string }).bannedAt).length
  const admins = users.filter((u) => (u as { role?: string }).role === 'admin').length

  // New users in the last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const newThisWeek = users.filter((u) => ((u as { createdAt?: string }).createdAt ?? '') >= weekAgo).length

  return ok(serialize({
    totalUsers: users.length,
    bannedUsers: banned,
    adminUsers: admins,
    newThisWeek,
    totalAccounts,
    totalTransactions,
    totalCategories,
    totalSavingsGoals,
    totalDebts,
    totalBills,
  }))
}
