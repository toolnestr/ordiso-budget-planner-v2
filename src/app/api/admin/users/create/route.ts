import bcrypt from 'bcryptjs'
import { getWhere, createAuto, batchCreate } from '@/lib/firestore'
import { ok, err } from '@/lib/api'
import { requireAdmin } from '@/lib/session'

export const dynamic = 'force-dynamic'

// Default categories copied into every new user's workspace.
const DEFAULT_CATEGORIES: { name: string; type: string; group: string; color: string; icon: string; rollover?: boolean; sortOrder: number }[] = [
  { name: 'Primary Income', type: 'INCOME', group: 'FIXED', color: 'emerald', icon: '💰', sortOrder: 0 },
  { name: 'Side Hustle', type: 'INCOME', group: 'VARIABLE', color: 'teal', icon: '💼', sortOrder: 1 },
  { name: 'Freelance', type: 'INCOME', group: 'VARIABLE', color: 'cyan', icon: '💻', sortOrder: 2 },
  { name: 'Rent / Housing', type: 'EXPENSE', group: 'FIXED', color: 'slate', icon: '🏠', sortOrder: 10 },
  { name: 'Utilities', type: 'EXPENSE', group: 'FIXED', color: 'amber', icon: '💡', sortOrder: 11 },
  { name: 'Internet', type: 'EXPENSE', group: 'FIXED', color: 'cyan', icon: '📶', sortOrder: 12 },
  { name: 'Phone Bill', type: 'EXPENSE', group: 'FIXED', color: 'purple', icon: '📱', sortOrder: 14 },
  { name: 'Groceries', type: 'EXPENSE', group: 'VARIABLE', color: 'green', icon: '🛒', rollover: true, sortOrder: 20 },
  { name: 'Dining Out', type: 'EXPENSE', group: 'VARIABLE', color: 'orange', icon: '🍔', rollover: true, sortOrder: 21 },
  { name: 'Transport', type: 'EXPENSE', group: 'VARIABLE', color: 'blue', icon: '⛽', sortOrder: 22 },
  { name: 'Entertainment', type: 'EXPENSE', group: 'VARIABLE', color: 'fuchsia', icon: '🎬', sortOrder: 23 },
  { name: 'Shopping', type: 'EXPENSE', group: 'VARIABLE', color: 'pink', icon: '🛍️', sortOrder: 24 },
  { name: 'Medical / Health', type: 'EXPENSE', group: 'VARIABLE', color: 'red', icon: '🩺', sortOrder: 25 },
  { name: 'Pets', type: 'EXPENSE', group: 'VARIABLE', color: 'amber', icon: '🐾', sortOrder: 26 },
  { name: 'Childcare', type: 'EXPENSE', group: 'VARIABLE', color: 'rose', icon: '👶', sortOrder: 27 },
  { name: 'Personal Care', type: 'EXPENSE', group: 'VARIABLE', color: 'teal', icon: '💇', sortOrder: 28 },
  { name: 'Emergency Fund', type: 'EXPENSE', group: 'SAVING', color: 'emerald', icon: '🛟', sortOrder: 40 },
  { name: 'Vacation Fund', type: 'EXPENSE', group: 'SAVING', color: 'cyan', icon: '🏖️', sortOrder: 41 },
  { name: 'Christmas Gifts', type: 'EXPENSE', group: 'SAVING', color: 'red', icon: '🎄', sortOrder: 42 },
  { name: 'Credit Card Debt', type: 'EXPENSE', group: 'DEBT', color: 'rose', icon: '💳', sortOrder: 50 },
  { name: 'Student Loan', type: 'EXPENSE', group: 'DEBT', color: 'purple', icon: '🎓', sortOrder: 51 },
  { name: 'Car Loan', type: 'EXPENSE', group: 'DEBT', color: 'blue', icon: '🚗', sortOrder: 52 },
]

// Admin-only: create a new user account. Public signup is disabled.
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return err('Forbidden', 403)

  try {
    const body = await req.json()
    const name = body.name?.trim()
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const role = body.role === 'admin' ? 'admin' : 'user'
    if (!name || !email || !password) return err('Name, email, and password are required')
    if (password.length < 6) return err('Password must be at least 6 characters')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err('Please enter a valid email')

    const existing = await getWhere('users', 'email', '==', email)
    if (existing.length) return err('An account with this email already exists')

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await createAuto<{ name: string; email: string; hashedPassword: string; role: string; createdAt: string }>('users', {
      name,
      email,
      hashedPassword,
      role,
      createdAt: new Date().toISOString(),
    })

    // Copy default categories into the new user's workspace
    const catDocs = DEFAULT_CATEGORIES.map((c) => ({ ...c, isSystem: true, userId: user.id }))
    await batchCreate('categories', catDocs)

    return ok({ id: user.id, name: user.name, email: user.email, role: user.role })
  } catch (e) {
    return err(`Create user failed: ${(e as Error).message}`, 500)
  }
}
