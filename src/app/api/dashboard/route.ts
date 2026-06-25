import { getById, upsertDoc, getWhere } from '@/lib/firestore'
import { ok, serialize, monthRange, startOfWeek } from '@/lib/api'
import { requireUser } from '@/lib/session'
import { monthName, monthShort } from '@/lib/format'
import type { Bill, Category, Account, Transaction, Settings, SavingsGoal, Debt, MonthlyBudget } from '@/lib/types'

export const dynamic = 'force-dynamic'

function computePayoff(balance: number, annualRate: number, payment: number): { months: number | null; totalInterest: number | null } {
  if (balance <= 0 || payment <= 0) return { months: balance <= 0 ? 0 : null, totalInterest: 0 }
  const r = annualRate / 100 / 12
  if (r === 0) return { months: Math.ceil(balance / payment), totalInterest: 0 }
  const interestFirst = balance * r
  if (payment <= interestFirst) return { months: null, totalInterest: null }
  const months = Math.ceil(Math.log(payment / (payment - balance * r)) / Math.log(1 + r))
  let b = balance
  let totalInterest = 0
  for (let i = 0; i < months; i++) {
    const interest = b * r
    totalInterest += interest
    b = b + interest - payment
    if (b <= 0) { b = 0; break }
  }
  return { months, totalInterest }
}

function nextDueDate(bill: Bill, from: Date): { date: Date; dueInDays: number } {
  const now = new Date(from)
  now.setHours(0, 0, 0, 0)
  let candidate = new Date(now.getFullYear(), now.getMonth(), Math.min(bill.dueDay, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()))
  if (candidate < now) {
    candidate = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(bill.dueDay, new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate()))
  }
  const periodMonths: Record<string, number> = { WEEKLY: 0, MONTHLY: 1, QUARTERLY: 3, BIANNUAL: 6, ANNUAL: 12 }
  const pm = periodMonths[bill.frequency] ?? 1
  if (bill.frequency === 'WEEKLY') {
    const wd = bill.dueDay % 7
    const diff = (wd - now.getDay() + 7) % 7
    candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (diff === 0 ? 7 : diff))
  } else if (pm > 1) {
    while (candidate < now) {
      candidate = new Date(candidate.getFullYear(), candidate.getMonth() + pm, Math.min(bill.dueDay, new Date(candidate.getFullYear(), candidate.getMonth() + pm + 1, 0).getDate()))
    }
  }
  const dueInDays = Math.round((candidate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return { date: candidate, dueInDays }
}

const DEFAULT_SETTINGS: Settings = {
  id: 'singleton', currencySymbol: '$', currencyCode: 'USD', cashEnvelopeMode: false, weeklyCheckinDay: 0, setupComplete: false, plannerName: 'Ordiso Planner',
}

export async function GET(req: Request) {
  const user = await requireUser()
  if (!user) return ok({ unauthorized: true }, { status: 401 })

  const url = new URL(req.url)
  const mParam = url.searchParams.get('month')
  const yParam = url.searchParams.get('year')
  const now = new Date()
  const month = mParam ? Number(mParam) : now.getMonth() + 1
  const year = yParam ? Number(yParam) : now.getFullYear()

  // Settings (per-user doc id)
  const settingsId = `singleton_${user.userId}`
  let settingsDoc = await getById<Settings>('settings', settingsId)
  if (!settingsDoc) settingsDoc = await upsertDoc<Settings & { userId: string }>('settings', settingsId, { ...DEFAULT_SETTINGS, userId: user.userId })
  const settings = settingsDoc

  const { start, end } = monthRange(month, year)
  const trendStart = new Date(year, month - 1 - 5, 1)

  // Fetch ALL of this user's transactions in a single-field query (no composite
  // index needed), then filter by date in memory. Per-user volume is small.
  const allTxs = await getWhere<Transaction>('transactions', 'userId', '==', user.userId)
  const categories = await getWhere<Category>('categories', 'userId', '==', user.userId)
  const catMap = new Map(categories.map((c) => [c.id, c]))

  const inRange = (t: Transaction, s: Date, e: Date) => {
    const d = new Date(t.date)
    return d >= s && d < e
  }
  const isTop = (t: Transaction) => !t.parentTransactionId

  const txs = allTxs.filter((t) => inRange(t, start, end) && isTop(t)).map((t) => ({ ...t, category: t.categoryId ? catMap.get(t.categoryId) ?? null : null }))

  const totalIncome = txs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = txs.filter((t) => t.type === 'EXPENSE' && t.category?.group !== 'SAVING').reduce((s, t) => s + t.amount, 0)
  const plannedSavingsAlloc = txs.filter((t) => t.type === 'EXPENSE' && t.category?.group === 'SAVING').reduce((s, t) => s + t.amount, 0)
  const netSavings = totalIncome - totalExpenses - plannedSavingsAlloc
  const leftToSpend = totalIncome - totalExpenses - plannedSavingsAlloc

  // Fetch this user's budgets (single-field query), filter by year/month in memory.
  const allBudgets = await getWhere<MonthlyBudget>('monthlyBudgets', 'userId', '==', user.userId)
  const budgets = allBudgets.filter((b) => b.year === year && b.month === month)
  const budgetsWithCat = budgets.map((b) => ({ ...b, category: catMap.get(b.categoryId) }))
  const plannedExpenses = budgetsWithCat.filter((b) => b.category && b.category.group !== 'SAVING' && b.category.group !== 'DEBT' && b.category.type === 'EXPENSE').reduce((s, b) => s + b.planned, 0)
  const plannedSavings = budgetsWithCat.filter((b) => b.category?.group === 'SAVING').reduce((s, b) => s + b.planned, 0)
  const plannedIncome = budgetsWithCat.filter((b) => b.category?.type === 'INCOME').reduce((s, b) => s + b.planned, 0)

  // Accounts
  const accounts = await getWhere<Account>('accounts', 'userId', '==', user.userId)
  accounts.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
  const txsByAccount = new Map<string, Transaction[]>()
  for (const t of allTxs) {
    if (!t.accountId) continue
    const arr = txsByAccount.get(t.accountId) ?? []
    arr.push(t)
    txsByAccount.set(t.accountId, arr)
  }
  const accountsWithBalance = accounts.map((a) => {
    const atxs = txsByAccount.get(a.id) ?? []
    const sum = atxs.reduce((acc, t) => acc + (t.type === 'INCOME' ? t.amount : t.type === 'EXPENSE' ? -t.amount : 0), 0)
    return { ...serialize(a), currentBalance: a.startingBalance + sum }
  })
  const netWorth = accountsWithBalance.reduce((s, a) => s + a.currentBalance, 0)

  const catAgg = new Map<string, { categoryId: string; name: string; color: string; icon: string; amount: number; budget: number }>()
  for (const t of txs) {
    if (t.type !== 'EXPENSE' || !t.category || t.category.group === 'SAVING') continue
    const key = t.categoryId ?? 'uncategorized'
    const existing = catAgg.get(key) ?? { categoryId: key, name: t.category.name, color: t.category.color, icon: t.category.icon, amount: 0, budget: 0 }
    existing.amount += t.amount
    catAgg.set(key, existing)
  }
  for (const b of budgetsWithCat) {
    if (!b.category || b.category.type !== 'EXPENSE' || b.category.group === 'SAVING') continue
    const existing = catAgg.get(b.categoryId)
    if (existing) existing.budget = b.planned
  }
  const expenseByCategory = Array.from(catAgg.values()).sort((a, b) => b.amount - a.amount)
  const overbudgetCategories = expenseByCategory.filter((c) => c.budget > 0 && c.amount > c.budget).map((c) => ({ name: c.name, color: c.color, budget: c.budget, spent: c.amount }))
  const topSpendingCategories = expenseByCategory.slice(0, 5)

  const trend: { month: string; income: number; expenses: number; savings: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1)
    const { start: s, end: e } = monthRange(d.getMonth() + 1, d.getFullYear())
    const monthTxs = allTxs.filter((t) => inRange(t, s, e) && isTop(t)).map((t) => ({ ...t, category: t.categoryId ? catMap.get(t.categoryId) ?? null : null }))
    const inc = monthTxs.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0)
    const exp = monthTxs.filter((t) => t.type === 'EXPENSE' && t.category?.group !== 'SAVING').reduce((sum, t) => sum + t.amount, 0)
    trend.push({ month: monthShort(d.getMonth() + 1), income: inc, expenses: exp, savings: inc - exp })
  }

  const goals = await getWhere<SavingsGoal>('savingsGoals', 'userId', '==', user.userId)
  goals.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const monthTxsAll = allTxs.filter((t) => inRange(t, start, end))
  const goalsWithProgress = goals.map((g) => {
    const contribTxs = monthTxsAll.filter((t) => t.type === 'EXPENSE' && typeof t.description === 'string' && t.description.includes(g.name))
    const monthlyContribution = contribTxs.reduce((s, t) => s + t.amount, 0)
    const progress = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0
    return { ...serialize(g), progress, remaining: Math.max(0, g.targetAmount - g.savedAmount), monthlyContribution }
  })

  const debts = await getWhere<Debt>('debts', 'userId', '==', user.userId)
  debts.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const debtsWithProgress = debts.map((d) => {
    const progress = d.originalBalance > 0 ? Math.min(100, ((d.originalBalance - d.currentBalance) / d.originalBalance) * 100) : 0
    const payoff = computePayoff(d.currentBalance, d.interestRate, d.minimumPayment)
    return { ...serialize(d), progress, payoffMonths: payoff.months, totalInterest: payoff.totalInterest }
  })

  const billsAll = await getWhere<Bill>('bills', 'userId', '==', user.userId)
  const bills = billsAll.filter((b) => b.active)
  const billsWithDue = bills.map((b) => {
    const { date, dueInDays } = nextDueDate(b, new Date())
    return { ...serialize(b), dueInDays, nextDueDate: date.toISOString() }
  })
  const billsDueSoon = billsWithDue.filter((b) => b.dueInDays >= 0 && b.dueInDays <= 14).sort((a, b) => a.dueInDays - b.dueInDays)

  const ws = startOfWeek()
  const weekId = `${user.userId}_${ws.toISOString()}`
  let checkin = await getById<Record<string, unknown>>('weeklyCheckins', weekId)
  if (!checkin) {
    checkin = await upsertDoc<Record<string, unknown>>('weeklyCheckins', weekId, {
      userId: user.userId,
      weekStart: ws.toISOString(),
      loggedReceipts: false,
      paidBills: false,
      reviewedBudget: false,
      reconciledAccounts: false,
      createdAt: new Date().toISOString(),
    })
  }

  return ok({
    settings: serialize(settings),
    month,
    year,
    monthName: monthName(month),
    totalIncome,
    totalExpenses,
    netSavings,
    leftToSpend,
    plannedSavings,
    plannedExpenses,
    plannedIncome,
    savingsRate: totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0,
    accounts: accountsWithBalance,
    netWorth,
    expenseByCategory,
    incomeVsExpenseTrend: trend,
    savingsGoals: goalsWithProgress,
    debts: debtsWithProgress,
    billsDueSoon,
    overbudgetCategories,
    topSpendingCategories,
    weeklyCheckin: serialize(checkin),
    transactionCount: txs.length,
  })
}
