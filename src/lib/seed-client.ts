'use client'

// Client-side seeding — creates admin + demo users directly in Firestore/Auth.
// Run once to populate the database with sample data.
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc, collection, writeBatch, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from './firebase'
import { monthName } from './format'
import type { Account, Category, IncomeSource, SavingsGoal, Debt, Bill, Transaction, MonthlyBudget } from './types'

const CAT_DEFS: { name: string; type: string; group: string; color: string; icon: string; rollover?: boolean; sortOrder: number }[] = [
  { name: 'Primary Income', type: 'INCOME', group: 'FIXED', color: 'emerald', icon: '💰', sortOrder: 0 },
  { name: 'Side Hustle', type: 'INCOME', group: 'VARIABLE', color: 'teal', icon: '💼', sortOrder: 1 },
  { name: 'Freelance', type: 'INCOME', group: 'VARIABLE', color: 'cyan', icon: '💻', sortOrder: 2 },
  { name: 'Rent / Housing', type: 'EXPENSE', group: 'FIXED', color: 'slate', icon: '🏠', sortOrder: 10 },
  { name: 'Utilities', type: 'EXPENSE', group: 'FIXED', color: 'amber', icon: '💡', sortOrder: 11 },
  { name: 'Internet', type: 'EXPENSE', group: 'FIXED', color: 'cyan', icon: '📶', sortOrder: 12 },
  { name: 'Car Insurance', type: 'EXPENSE', group: 'FIXED', color: 'violet', icon: '🚗', sortOrder: 13 },
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

async function createDemoUser(email: string, password: string, name: string, role: 'admin' | 'user', isDemo: boolean) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: name })
    await setDoc(doc(db, 'users', cred.user.uid), {
      name, email, role, isDemo, createdAt: new Date().toISOString(),
    })
    return cred.user.uid
  } catch (e) {
    // User might already exist — try to find their uid
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)))
    if (snap.docs.length) return snap.docs[0].id
    throw e
  }
}

export async function seedClient(): Promise<{ message: string }> {
  const now = new Date()
  const curMonth = now.getMonth() + 1
  const curYear = now.getFullYear()

  // Create admin + demo users
  const adminId = await createDemoUser('admin@ordiso.app', 'admin123', 'Admin', 'admin', false)
  const demoId = await createDemoUser('demo@ordiso.app', 'demo123', 'Demo User', 'user', true)

  // Admin gets default categories only
  const adminBatch = writeBatch(db)
  CAT_DEFS.forEach((c) => adminBatch.set(doc(collection(db, 'categories')), { ...c, isSystem: true, userId: adminId }))
  await adminBatch.commit()

  // Demo user gets full sample data
  const userId = demoId

  await setDoc(doc(db, 'settings', `singleton_${userId}`), {
    userId, currencySymbol: '$', currencyCode: 'USD', cashEnvelopeMode: false,
    weeklyCheckinDay: 0, setupComplete: true, plannerName: 'Ordiso Planner',
  })

  // Accounts
  const accountDefs = [
    { name: 'Everyday Checking', type: 'CHECKING', startingBalance: 2400, color: 'emerald' },
    { name: 'High-Yield Savings', type: 'SAVINGS', startingBalance: 5200, color: 'teal' },
    { name: 'Rewards Credit Card', type: 'CREDIT', startingBalance: -850, color: 'rose' },
    { name: 'Cash Wallet', type: 'CASH', startingBalance: 80, color: 'amber' },
  ]
  const aMap: Record<string, string> = {}
  for (const a of accountDefs) {
    const ref = doc(collection(db, 'accounts'))
    await setDoc(ref, { ...a, userId, createdAt: now.toISOString() })
    aMap[a.name] = ref.id
  }

  // Categories
  const cMap: Record<string, string> = {}
  for (const c of CAT_DEFS) {
    const ref = doc(collection(db, 'categories'))
    await setDoc(ref, { ...c, isSystem: true, userId })
    cMap[c.name] = ref.id
  }

  // Income sources
  const incomeBatch = writeBatch(db)
  ;([
    { name: 'Day Job Salary', type: 'PRIMARY', expectedMonthly: 4500, isIrregular: false, sortOrder: 0, userId, createdAt: now.toISOString() },
    { name: 'Freelance Design', type: 'SIDE', expectedMonthly: 800, isIrregular: true, notes: 'Varies month to month', sortOrder: 1, userId, createdAt: now.toISOString() },
    { name: 'Dividend Income', type: 'PASSIVE', expectedMonthly: 120, isIrregular: false, sortOrder: 2, userId, createdAt: now.toISOString() },
  ] as (IncomeSource & { createdAt: string })[]).forEach((item) => incomeBatch.set(doc(collection(db, 'incomeSources')), item))
  await incomeBatch.commit()

  // Savings goals
  const goalsBatch = writeBatch(db)
  ;([
    { name: 'Emergency Fund', targetAmount: 15000, savedAmount: 8200, color: 'emerald', icon: '🛟', sortOrder: 0, targetDate: new Date(curYear + 1, 5, 1).toISOString(), userId, createdAt: now.toISOString() },
    { name: 'Summer Vacation', targetAmount: 4000, savedAmount: 2600, color: 'cyan', icon: '🏖️', sortOrder: 1, targetDate: new Date(curYear, 6, 15).toISOString(), userId, createdAt: now.toISOString() },
    { name: 'Christmas Gifts', targetAmount: 1200, savedAmount: 480, color: 'red', icon: '🎄', sortOrder: 2, targetDate: new Date(curYear, 11, 1).toISOString(), userId, createdAt: now.toISOString() },
    { name: 'New Car Down Payment', targetAmount: 8000, savedAmount: 1900, color: 'slate', icon: '🚙', sortOrder: 3, targetDate: new Date(curYear + 1, 11, 1).toISOString(), userId, createdAt: now.toISOString() },
  ] as (SavingsGoal & { createdAt: string })[]).forEach((g) => goalsBatch.set(doc(collection(db, 'savingsGoals')), g))
  await goalsBatch.commit()

  // Debts + payments
  const debtDefs = [
    { name: 'Visa Rewards Card', creditor: 'Chase', currentBalance: 1850, originalBalance: 3200, interestRate: 22.9, minimumPayment: 75, strategy: 'AVALANCHE', sortOrder: 0 },
    { name: 'Sallie Mae Student Loan', creditor: 'Sallie Mae', currentBalance: 12500, originalBalance: 22000, interestRate: 5.5, minimumPayment: 180, strategy: 'AVALANCHE', sortOrder: 1 },
    { name: 'Auto Loan', creditor: 'Toyota Financial', currentBalance: 8000, originalBalance: 18000, interestRate: 4.2, minimumPayment: 320, strategy: 'AVALANCHE', sortOrder: 2 },
  ]
  const payBatch = writeBatch(db)
  for (const d of debtDefs) {
    const ref = doc(collection(db, 'debts'))
    await setDoc(ref, { ...d, paidOff: false, userId, createdAt: now.toISOString() })
    for (let m = 5; m >= 0; m--) {
      const date = new Date(curYear, curMonth - 1 - m, 15).toISOString()
      payBatch.set(doc(collection(db, 'debtPayments')), { debtId: ref.id, date, amount: d.minimumPayment, note: 'Minimum payment', userId, createdAt: now.toISOString() })
    }
  }
  await payBatch.commit()

  // Bills
  const billsBatch = writeBatch(db)
  ;([
    { name: 'Rent', amount: 1450, frequency: 'MONTHLY', dueDay: 1, category: 'Rent / Housing', isSubscription: false, active: true, lastPaidDate: new Date(curYear, curMonth - 1, 1).toISOString(), userId, createdAt: now.toISOString() },
    { name: 'Electric & Gas', amount: 140, frequency: 'MONTHLY', dueDay: 18, category: 'Utilities', isSubscription: false, active: true, lastPaidDate: new Date(curYear, curMonth - 2, 18).toISOString(), userId, createdAt: now.toISOString() },
    { name: 'Internet', amount: 65, frequency: 'MONTHLY', dueDay: 5, category: 'Internet', isSubscription: false, active: true, lastPaidDate: new Date(curYear, curMonth - 1, 5).toISOString(), userId, createdAt: now.toISOString() },
    { name: 'Phone Plan', amount: 55, frequency: 'MONTHLY', dueDay: 22, category: 'Phone Bill', isSubscription: false, active: true, userId, createdAt: now.toISOString() },
    { name: 'Netflix', amount: 15.49, frequency: 'MONTHLY', dueDay: 12, category: 'Entertainment', isSubscription: true, cancelFlag: false, active: true, userId, createdAt: now.toISOString() },
    { name: 'Spotify Family', amount: 16.99, frequency: 'MONTHLY', dueDay: 9, category: 'Entertainment', isSubscription: true, cancelFlag: false, active: true, userId, createdAt: now.toISOString() },
    { name: 'Gym Membership', amount: 39.99, frequency: 'MONTHLY', dueDay: 3, category: 'Personal Care', isSubscription: true, cancelFlag: true, active: true, userId, createdAt: now.toISOString() },
    { name: 'Cloud Storage', amount: 9.99, frequency: 'MONTHLY', dueDay: 14, category: 'Internet', isSubscription: true, cancelFlag: false, active: true, userId, createdAt: now.toISOString() },
    { name: 'Amazon Prime', amount: 139, frequency: 'ANNUAL', dueDay: 20, category: 'Shopping', isSubscription: true, cancelFlag: false, active: true, userId, createdAt: now.toISOString() },
    { name: 'Car Insurance', amount: 780, frequency: 'BIANNUAL', dueDay: 10, category: 'Car Insurance', isSubscription: false, active: true, userId, createdAt: now.toISOString() },
    { name: 'Software Subscription', amount: 24, frequency: 'MONTHLY', dueDay: 25, category: 'Internet', isSubscription: true, cancelFlag: true, active: true, userId, createdAt: now.toISOString() },
  ] as (Bill & { createdAt: string })[]).forEach((b) => billsBatch.set(doc(collection(db, 'bills')), b))
  await billsBatch.commit()

  // Transactions (6 months)
  const txBatch = writeBatch(db)
  for (let m = 5; m >= 0; m--) {
    const monthDate = new Date(curYear, curMonth - 1 - m, 1)
    const my = monthDate.getFullYear(), mm = monthDate.getMonth() + 1
    const dim = new Date(my, mm, 0).getDate()
    const mk = (day: number) => new Date(my, mm - 1, Math.min(day, dim)).toISOString()
    const tx = (date: string, description: string, amount: number, type: string, cat: string, acc: string) =>
      txBatch.set(doc(collection(db, 'transactions')), {
        date, description, amount, type, categoryId: cMap[cat], accountId: aMap[acc],
        isSplit: false, parentTransactionId: null, isReconciled: false, userId, createdAt: now.toISOString(),
      })
    tx(mk(1), 'Salary Deposit', 2250, 'INCOME', 'Primary Income', 'Everyday Checking')
    tx(mk(15), 'Salary Deposit', 2250, 'INCOME', 'Primary Income', 'Everyday Checking')
    if (m % 2 === 0) tx(mk(20), 'Freelance — Logo Design', 450 + m * 50, 'INCOME', 'Freelance', 'Everyday Checking')
    if (m === 1 || m === 4) tx(mk(22), 'Freelance — Website', 900, 'INCOME', 'Freelance', 'Everyday Checking')
    tx(mk(28), 'Dividend Payout', 120, 'INCOME', 'Freelance', 'High-Yield Savings')
    tx(mk(1), 'Rent Payment', 1450, 'EXPENSE', 'Rent / Housing', 'Everyday Checking')
    tx(mk(18), 'Electric & Gas', 120 + Math.round(Math.random() * 40), 'EXPENSE', 'Utilities', 'Everyday Checking')
    tx(mk(5), 'Internet Bill', 65, 'EXPENSE', 'Internet', 'Everyday Checking')
    tx(mk(22), 'Phone Bill', 55, 'EXPENSE', 'Phone Bill', 'Everyday Checking')
    tx(mk(12), 'Netflix', 15.49, 'EXPENSE', 'Entertainment', 'Rewards Credit Card')
    tx(mk(9), 'Spotify', 16.99, 'EXPENSE', 'Entertainment', 'Rewards Credit Card')
    tx(mk(3), 'Gym Membership', 39.99, 'EXPENSE', 'Personal Care', 'Everyday Checking')
    const groceryRuns = 4 + Math.floor(Math.random() * 2)
    for (let g = 0; g < groceryRuns; g++) { const day = Math.min(dim, 3 + g * 7 + Math.floor(Math.random() * 3)); tx(mk(day), ['Whole Foods', 'Trader Joes', 'Costco', 'Local Market'][g % 4], 60 + Math.round(Math.random() * 90), 'EXPENSE', 'Groceries', 'Rewards Credit Card') }
    const eats = 3 + Math.floor(Math.random() * 3)
    for (let e = 0; e < eats; e++) { const day = Math.min(dim, 2 + e * 9 + Math.floor(Math.random() * 4)); tx(mk(day), ['Starbucks', 'Chipotle', 'Local Bistro', 'DoorDash', 'Pizza Place'][e % 5], 12 + Math.round(Math.random() * 45), 'EXPENSE', 'Dining Out', 'Rewards Credit Card') }
    tx(mk(10), 'Shell Gas', 45 + Math.round(Math.random() * 25), 'EXPENSE', 'Transport', 'Everyday Checking')
    tx(mk(24), 'Shell Gas', 45 + Math.round(Math.random() * 25), 'EXPENSE', 'Transport', 'Everyday Checking')
    if (m === 0 || m === 2) tx(mk(14), 'Target Run', 80 + Math.round(Math.random() * 60), 'EXPENSE', 'Shopping', 'Rewards Credit Card')
    tx(mk(16), 'Movie Tickets', 28, 'EXPENSE', 'Entertainment', 'Everyday Checking')
    if (m === 1 || m === 4) tx(mk(12), 'Pharmacy — Prescription', 35, 'EXPENSE', 'Medical / Health', 'Everyday Checking')
    tx(mk(8), 'Pet Food & Supplies', 55, 'EXPENSE', 'Pets', 'Rewards Credit Card')
    tx(mk(19), 'Haircut', 35, 'EXPENSE', 'Personal Care', 'Everyday Checking')
    tx(mk(2), 'Emergency Fund Contribution', 400, 'EXPENSE', 'Emergency Fund', 'High-Yield Savings')
    tx(mk(2), 'Vacation Fund Contribution', 200, 'EXPENSE', 'Vacation Fund', 'High-Yield Savings')
    tx(mk(2), 'Christmas Fund Contribution', 100, 'EXPENSE', 'Christmas Gifts', 'High-Yield Savings')
    tx(mk(15), 'Visa Card Payment', 250, 'EXPENSE', 'Credit Card Debt', 'Everyday Checking')
    tx(mk(15), 'Student Loan Payment', 180, 'EXPENSE', 'Student Loan', 'Everyday Checking')
    tx(mk(15), 'Auto Loan Payment', 320, 'EXPENSE', 'Car Loan', 'Everyday Checking')
  }
  await txBatch.commit()

  // Budgets for current month
  const budgetPlan: Record<string, number> = {
    'Rent / Housing': 1450, 'Utilities': 160, 'Internet': 65, 'Phone Bill': 55,
    'Groceries': 450, 'Dining Out': 200, 'Transport': 120, 'Entertainment': 80, 'Shopping': 120,
    'Medical / Health': 50, 'Pets': 60, 'Personal Care': 60,
    'Emergency Fund': 400, 'Vacation Fund': 200, 'Christmas Gifts': 100,
    'Credit Card Debt': 250, 'Student Loan': 180, 'Car Loan': 320,
  }
  const bBatch = writeBatch(db)
  Object.entries(budgetPlan).forEach(([name, planned]) => {
    bBatch.set(doc(db, 'monthlyBudgets', `${userId}_${curYear}_${curMonth}_${cMap[name]}`), { userId, month: curMonth, year: curYear, categoryId: cMap[name], planned })
  })
  await bBatch.commit()

  return { message: `Seeded admin + demo user with ${monthName(curMonth)} ${curYear} data.` }
}
