import { db } from '@/lib/db'
import { ok, err, serialize, monthRange, startOfWeek } from '@/lib/api'
import { monthName, monthShort } from '@/lib/format'
import type { Bill } from '@prisma/client'

export const dynamic = 'force-dynamic'

function computePayoff(balance: number, annualRate: number, payment: number): { months: number | null; totalInterest: number | null } {
  if (balance <= 0 || payment <= 0) return { months: balance <= 0 ? 0 : null, totalInterest: 0 }
  const r = annualRate / 100 / 12
  if (r === 0) {
    return { months: Math.ceil(balance / payment), totalInterest: 0 }
  }
  const interestFirst = balance * r
  if (payment <= interestFirst) return { months: null, totalInterest: null } // won't ever pay off
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
    // move to next period
    candidate = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(bill.dueDay, new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate()))
  }
  // For non-monthly, approximate by advancing months until due
  const periodMonths: Record<string, number> = { WEEKLY: 0, MONTHLY: 1, QUARTERLY: 3, BIANNUAL: 6, ANNUAL: 12 }
  const pm = periodMonths[bill.frequency] ?? 1
  if (bill.frequency === 'WEEKLY') {
    const wd = bill.dueDay % 7
    const diff = (wd - now.getDay() + 7) % 7
    candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (diff === 0 ? 7 : diff))
  } else if (pm > 1) {
    // advance until candidate is in future
    while (candidate < now) {
      candidate = new Date(candidate.getFullYear(), candidate.getMonth() + pm, Math.min(bill.dueDay, new Date(candidate.getFullYear(), candidate.getMonth() + pm + 1, 0).getDate()))
    }
  }
  const dueInDays = Math.round((candidate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return { date: candidate, dueInDays }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const mParam = url.searchParams.get('month')
  const yParam = url.searchParams.get('year')
  const now = new Date()
  const month = mParam ? Number(mParam) : now.getMonth() + 1
  const year = yParam ? Number(yParam) : now.getFullYear()

  const settings = (await db.settings.findUnique({ where: { id: 'singleton' } })) ?? {
    id: 'singleton', currencySymbol: '$', currencyCode: 'USD', cashEnvelopeMode: false, weeklyCheckinDay: 0, setupComplete: false, plannerName: 'FinFlow Planner',
  }

  const { start, end } = monthRange(month, year)

  // Transactions for the month
  const txs = await db.transaction.findMany({
    where: { date: { gte: start, lt: end }, parentTransactionId: null },
    include: { category: true, account: true },
  })

  const totalIncome = txs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = txs.filter((t) => t.type === 'EXPENSE' && t.category?.group !== 'SAVING').reduce((s, t) => s + t.amount, 0)
  const plannedSavingsAlloc = txs.filter((t) => t.type === 'EXPENSE' && t.category?.group === 'SAVING').reduce((s, t) => s + t.amount, 0)
  const netSavings = totalIncome - totalExpenses - plannedSavingsAlloc
  const leftToSpend = totalIncome - totalExpenses - plannedSavingsAlloc

  // Budgets
  const budgets = await db.monthlyBudget.findMany({ where: { month, year }, include: { category: true } })
  const plannedExpenses = budgets.filter((b) => b.category.group !== 'SAVING' && b.category.group !== 'DEBT' && b.category.type === 'EXPENSE').reduce((s, b) => s + b.planned, 0)
  const plannedSavings = budgets.filter((b) => b.category.group === 'SAVING').reduce((s, b) => s + b.planned, 0)
  const plannedIncome = budgets.filter((b) => b.category.type === 'INCOME').reduce((s, b) => s + b.planned, 0)

  // Accounts with balances
  const accounts = await db.account.findMany({ orderBy: { createdAt: 'asc' } })
  const accountsWithBalance = await Promise.all(
    accounts.map(async (a) => {
      const atxs = await db.transaction.findMany({ where: { accountId: a.id } })
      const sum = atxs.reduce((acc, t) => acc + (t.type === 'INCOME' ? t.amount : t.type === 'EXPENSE' ? -t.amount : 0), 0)
      return { ...serialize(a), currentBalance: a.startingBalance + sum }
    })
  )
  const netWorth = accountsWithBalance.reduce((s, a) => s + a.currentBalance, 0)

  // Expense by category
  const catMap = new Map<string, { categoryId: string; name: string; color: string; icon: string; amount: number; budget: number }>()
  for (const t of txs) {
    if (t.type !== 'EXPENSE' || !t.category || t.category.group === 'SAVING') continue
    const key = t.categoryId ?? 'uncategorized'
    const existing = catMap.get(key) ?? { categoryId: key, name: t.category?.name ?? 'Uncategorized', color: t.category?.color ?? 'slate', icon: t.category?.icon ?? '📁', amount: 0, budget: 0 }
    existing.amount += t.amount
    catMap.set(key, existing)
  }
  for (const b of budgets) {
    if (b.category.type !== 'EXPENSE' || b.category.group === 'SAVING') continue
    const existing = catMap.get(b.categoryId)
    if (existing) existing.budget = b.planned
  }
  const expenseByCategory = Array.from(catMap.values()).sort((a, b) => b.amount - a.amount)

  // Overbudget categories
  const overbudgetCategories = expenseByCategory.filter((c) => c.budget > 0 && c.amount > c.budget).map((c) => ({ name: c.name, color: c.color, budget: c.budget, spent: c.amount }))

  // Top spending
  const topSpendingCategories = expenseByCategory.slice(0, 5)

  // Income vs Expense trend (6 months including current)
  const trend: { month: string; income: number; expenses: number; savings: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1)
    const { start: s, end: e } = monthRange(d.getMonth() + 1, d.getFullYear())
    const monthTxs = await db.transaction.findMany({ where: { date: { gte: s, lt: e }, parentTransactionId: null }, include: { category: true } })
    const inc = monthTxs.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0)
    const exp = monthTxs.filter((t) => t.type === 'EXPENSE' && t.category?.group !== 'SAVING').reduce((sum, t) => sum + t.amount, 0)
    trend.push({ month: monthShort(d.getMonth() + 1), income: inc, expenses: exp, savings: inc - exp })
  }

  // Savings goals with progress + monthly contribution (from this month's transactions)
  const goals = await db.savingsGoal.findMany({ orderBy: { sortOrder: 'asc' } })
  const goalsWithProgress = await Promise.all(
    goals.map(async (g) => {
      const contribTxs = await db.transaction.findMany({
        where: { date: { gte: start, lt: end }, type: 'EXPENSE', description: { contains: g.name } },
      })
      const monthlyContribution = contribTxs.reduce((s, t) => s + t.amount, 0)
      const progress = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0
      return { ...serialize(g), progress, remaining: Math.max(0, g.targetAmount - g.savedAmount), monthlyContribution }
    })
  )

  // Debts with progress + payoff
  const debts = await db.debt.findMany({ orderBy: { sortOrder: 'asc' } })
  const debtsWithProgress = debts.map((d) => {
    const progress = d.originalBalance > 0 ? Math.min(100, ((d.originalBalance - d.currentBalance) / d.originalBalance) * 100) : 0
    const payoff = computePayoff(d.currentBalance, d.interestRate, d.minimumPayment)
    return { ...serialize(d), progress, payoffMonths: payoff.months, totalInterest: payoff.totalInterest }
  })

  // Bills due soon (next 14 days)
  const bills = await db.bill.findMany({ where: { active: true } })
  const billsWithDue = bills.map((b) => {
    const { date, dueInDays } = nextDueDate(b, new Date())
    return { ...serialize(b), dueInDays, nextDueDate: date.toISOString() }
  })
  const billsDueSoon = billsWithDue.filter((b) => b.dueInDays >= 0 && b.dueInDays <= 14).sort((a, b) => a.dueInDays - b.dueInDays)

  // Weekly checkin
  const ws = startOfWeek()
  let checkin = await db.weeklyCheckin.findUnique({ where: { weekStart: ws } })
  if (!checkin) checkin = await db.weeklyCheckin.create({ data: { weekStart: ws } })

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
