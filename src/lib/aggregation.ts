'use client'

// Client-side aggregation — replaces the server-side dashboard/budgets/reports
// API routes. Computes the same data directly from Firestore in the browser.
import {
  getCategories, getAccounts, getTransactions, getBudgets, getSavingsGoals,
  getDebts, getBills, getSettings, getWeeklyCheckin,
} from './db'
import type { Category, Account, Transaction, SavingsGoal, Debt, Bill, MonthlyBudget, Settings } from './types'
import { monthName, monthShort } from './format'

function computePayoff(balance: number, annualRate: number, payment: number) {
  if (balance <= 0 || payment <= 0) return { months: balance <= 0 ? 0 : null, totalInterest: 0 }
  const r = annualRate / 100 / 12
  if (r === 0) return { months: Math.ceil(balance / payment), totalInterest: 0 }
  if (payment <= balance * r) return { months: null, totalInterest: null }
  const months = Math.ceil(Math.log(payment / (payment - balance * r)) / Math.log(1 + r))
  let b = balance, totalInterest = 0
  for (let i = 0; i < months; i++) { const interest = b * r; totalInterest += interest; b = b + interest - payment; if (b <= 0) break }
  return { months, totalInterest }
}

function nextDueDate(bill: Bill, from: Date) {
  const now = new Date(from); now.setHours(0, 0, 0, 0)
  let candidate = new Date(now.getFullYear(), now.getMonth(), Math.min(bill.dueDay, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()))
  if (candidate < now) candidate = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(bill.dueDay, new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate()))
  const pm: Record<string, number> = { WEEKLY: 0, MONTHLY: 1, QUARTERLY: 3, BIANNUAL: 6, ANNUAL: 12 }
  const interval = pm[bill.frequency] ?? 1
  if (bill.frequency === 'WEEKLY') {
    const diff = ((bill.dueDay % 7) - now.getDay() + 7) % 7
    candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (diff === 0 ? 7 : diff))
  } else if (interval > 1) {
    while (candidate < now) candidate = new Date(candidate.getFullYear(), candidate.getMonth() + interval, Math.min(bill.dueDay, new Date(candidate.getFullYear(), candidate.getMonth() + interval + 1, 0).getDate()))
  }
  return { date: candidate, dueInDays: Math.round((candidate.getTime() - now.getTime()) / 86400000) }
}

export interface DashboardData {
  settings: Settings; month: number; year: number; monthName: string;
  totalIncome: number; totalExpenses: number; netSavings: number; leftToSpend: number;
  plannedSavings: number; plannedExpenses: number; plannedIncome: number; savingsRate: number;
  accounts: (Account & { currentBalance: number })[]; netWorth: number;
  expenseByCategory: { categoryId: string; name: string; color: string; icon: string; amount: number; budget: number }[];
  incomeVsExpenseTrend: { month: string; income: number; expenses: number; savings: number }[];
  savingsGoals: (SavingsGoal & { progress: number; remaining: number; monthlyContribution: number })[];
  debts: (Debt & { progress: number; payoffMonths: number | null; totalInterest: number | null })[];
  billsDueSoon: (Bill & { dueInDays: number; nextDueDate: string })[];
  overbudgetCategories: { name: string; color: string; budget: number; spent: number }[];
  topSpendingCategories: { name: string; color: string; icon: string; amount: number }[];
  weeklyCheckin: { id: string; loggedReceipts: boolean; paidBills: boolean; reviewedBudget: boolean; reconciledAccounts: boolean };
  transactionCount: number;
}

export async function getDashboard(userId: string, month: number, year: number): Promise<DashboardData> {
  const [settings, categories, accounts, allTxs, budgets, goals, debts, billsAll, checkin] = await Promise.all([
    getSettings(userId), getCategories(userId), getAccounts(userId), getTransactions(userId),
    getBudgets(userId, month, year), getSavingsGoals(userId), getDebts(userId), getBills(userId), getWeeklyCheckin(userId),
  ])
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const inRange = (t: Transaction, s: Date, e: Date) => { const d = new Date(t.date); return d >= s && d < e }
  const isTop = (t: Transaction) => !t.parentTransactionId

  const start = new Date(year, month - 1, 1), end = new Date(year, month, 1)
  const txs = allTxs.filter((t) => inRange(t, start, end) && isTop(t))

  const totalIncome = txs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
  // Count ALL expenses (including uncategorized) for total — fix: previously excluded uncategorized
  const totalExpenses = txs.filter((t) => t.type === 'EXPENSE' && t.category?.group !== 'SAVING').reduce((s, t) => s + t.amount, 0)
  const plannedSavingsAlloc = txs.filter((t) => t.type === 'EXPENSE' && t.category?.group === 'SAVING').reduce((s, t) => s + t.amount, 0)
  const netSavings = totalIncome - totalExpenses - plannedSavingsAlloc
  const leftToSpend = netSavings

  const budgetsWithCat = budgets.map((b) => ({ ...b, category: catMap.get(b.categoryId) }))
  const plannedExpenses = budgetsWithCat.filter((b) => b.category && b.category.group !== 'SAVING' && b.category.group !== 'DEBT' && b.category.type === 'EXPENSE').reduce((s, b) => s + b.planned, 0)
  const plannedSavings = budgetsWithCat.filter((b) => b.category?.group === 'SAVING').reduce((s, b) => s + b.planned, 0)
  const plannedIncome = budgetsWithCat.filter((b) => b.category?.type === 'INCOME').reduce((s, b) => s + b.planned, 0)

  const netWorth = accounts.reduce((s, a) => s + a.currentBalance, 0)

  // Expense by category — include uncategorized under "Uncategorized"
  const catAgg = new Map<string, { categoryId: string; name: string; color: string; icon: string; amount: number; budget: number }>()
  for (const t of txs) {
    if (t.type !== 'EXPENSE' || t.category?.group === 'SAVING') continue
    const key = t.categoryId ?? 'uncategorized'
    const cat = t.category
    const existing = catAgg.get(key) ?? { categoryId: key, name: cat?.name ?? 'Uncategorized', color: cat?.color ?? 'slate', icon: cat?.icon ?? '📁', amount: 0, budget: 0 }
    existing.amount += t.amount
    catAgg.set(key, existing)
  }
  for (const b of budgetsWithCat) { if (!b.category || b.category.type !== 'EXPENSE' || b.category.group === 'SAVING') continue; const e = catAgg.get(b.categoryId); if (e) e.budget = b.planned }
  const expenseByCategory = Array.from(catAgg.values()).sort((a, b) => b.amount - a.amount)
  const overbudgetCategories = expenseByCategory.filter((c) => c.budget > 0 && c.amount > c.budget).map((c) => ({ name: c.name, color: c.color, budget: c.budget, spent: c.amount }))
  const topSpendingCategories = expenseByCategory.slice(0, 5)

  // 6-month trend
  const trend: { month: string; income: number; expenses: number; savings: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1)
    const s = new Date(d.getFullYear(), d.getMonth(), 1), e = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const mTxs = allTxs.filter((t) => inRange(t, s, e) && isTop(t))
    const inc = mTxs.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0)
    const exp = mTxs.filter((t) => t.type === 'EXPENSE' && t.category?.group !== 'SAVING').reduce((sum, t) => sum + t.amount, 0)
    trend.push({ month: monthShort(d.getMonth() + 1), income: inc, expenses: exp, savings: inc - exp })
  }

  const monthTxsAll = allTxs.filter((t) => inRange(t, start, end))
  const goalsWithProgress = goals.map((g) => {
    const contrib = monthTxsAll.filter((t) => t.type === 'EXPENSE' && typeof t.description === 'string' && t.description.includes(g.name)).reduce((s, t) => s + t.amount, 0)
    const progress = g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0
    return { ...g, progress, remaining: Math.max(0, g.targetAmount - g.savedAmount), monthlyContribution: contrib }
  })

  const debtsWithProgress = debts.map((d) => {
    const progress = d.originalBalance > 0 ? Math.min(100, ((d.originalBalance - d.currentBalance) / d.originalBalance) * 100) : 0
    const payoff = computePayoff(d.currentBalance, d.interestRate, d.minimumPayment)
    return { ...d, progress, payoffMonths: payoff.months, totalInterest: payoff.totalInterest }
  })

  const bills = billsAll.filter((b) => b.active)
  const billsWithDue = bills.map((b) => { const { date, dueInDays } = nextDueDate(b, new Date()); return { ...b, dueInDays, nextDueDate: date.toISOString() } })
  const billsDueSoon = billsWithDue.filter((b) => b.dueInDays >= 0 && b.dueInDays <= 14).sort((a, b) => a.dueInDays - b.dueInDays)

  return {
    settings, month, year, monthName: monthName(month),
    totalIncome, totalExpenses, netSavings, leftToSpend, plannedSavings, plannedExpenses, plannedIncome,
    savingsRate: totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0,
    accounts, netWorth, expenseByCategory, incomeVsExpenseTrend: trend,
    savingsGoals: goalsWithProgress, debts: debtsWithProgress, billsDueSoon,
    overbudgetCategories, topSpendingCategories, weeklyCheckin: checkin as never,
    transactionCount: txs.length,
  }
}

// ──────────── Budget rows (planned vs actual) ────────────
export async function getBudgetRows(userId: string, month: number, year: number) {
  const [categories, allTxs, budgets] = await Promise.all([
    getCategories(userId), getTransactions(userId), getBudgets(userId, month, year),
  ])
  const start = new Date(year, month - 1, 1), end = new Date(year, month, 1)
  const txs = allTxs.filter((t) => { const d = new Date(t.date); return d >= start && d < end && !t.parentTransactionId })
  const prevMonth = month === 1 ? 12 : month - 1, prevYear = month === 1 ? year - 1 : year
  const ps = new Date(prevYear, prevMonth - 1, 1), pe = new Date(prevYear, prevMonth, 1)
  const prevTxs = allTxs.filter((t) => { const d = new Date(t.date); return d >= ps && d < pe && !t.parentTransactionId })
  const prevBudgets = await getBudgets(userId, prevMonth, prevYear)

  const actualMap = new Map<string, number>()
  for (const t of txs) { if (!t.categoryId) continue; actualMap.set(t.categoryId, (actualMap.get(t.categoryId) ?? 0) + (t.type === 'EXPENSE' || t.type === 'INCOME' ? t.amount : 0)) }
  const prevActualMap = new Map<string, number>()
  for (const t of prevTxs) { if (!t.categoryId) continue; prevActualMap.set(t.categoryId, (prevActualMap.get(t.categoryId) ?? 0) + t.amount) }
  const prevPlannedMap = new Map(prevBudgets.map((b) => [b.categoryId, b.planned]))
  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.planned]))

  const rows = categories.filter((c) => c.type === 'EXPENSE' || c.type === 'INCOME').map((c) => {
    const planned = budgetMap.get(c.id) ?? 0
    const actual = actualMap.get(c.id) ?? 0
    const rolloverIn = c.rollover ? Math.max(0, (prevPlannedMap.get(c.id) ?? 0) - (prevActualMap.get(c.id) ?? 0)) : 0
    const effectiveBudget = planned + rolloverIn
    const remaining = c.type === 'INCOME' ? actual - planned : effectiveBudget - actual
    const progress = effectiveBudget > 0 ? Math.min(150, (actual / effectiveBudget) * 100) : actual > 0 ? 100 : 0
    return { categoryId: c.id, category: c, planned, actual, rolloverIn, remaining, progress, hasBudget: planned > 0 || actual > 0 }
  })

  const expenseRows = rows.filter((r) => r.category.type === 'EXPENSE')
  const incomeRows = rows.filter((r) => r.category.type === 'INCOME')
  const plannedIncome = incomeRows.reduce((s, r) => s + r.planned, 0)
  const actualIncome = incomeRows.reduce((s, r) => s + r.actual, 0)
  const plannedExpenses = expenseRows.filter((r) => r.category.group !== 'SAVING' && r.category.group !== 'DEBT').reduce((s, r) => s + r.planned, 0)
  const actualExpenses = expenseRows.filter((r) => r.category.group !== 'SAVING' && r.category.group !== 'DEBT').reduce((s, r) => s + r.actual, 0)
  const plannedSavings = expenseRows.filter((r) => r.category.group === 'SAVING').reduce((s, r) => s + r.planned, 0)
  const actualSavings = expenseRows.filter((r) => r.category.group === 'SAVING').reduce((s, r) => s + r.actual, 0)
  const plannedDebt = expenseRows.filter((r) => r.category.group === 'DEBT').reduce((s, r) => s + r.planned, 0)
  const actualDebt = expenseRows.filter((r) => r.category.group === 'DEBT').reduce((s, r) => s + r.actual, 0)

  return {
    rows,
    summary: {
      plannedIncome, actualIncome, plannedExpenses, actualExpenses,
      plannedSavings, actualSavings, plannedDebt, actualDebt,
      leftToSpend: actualIncome - actualExpenses - actualSavings - actualDebt,
      plannedLeftToSpend: plannedIncome - plannedExpenses - plannedSavings - plannedDebt,
    },
  }
}

// ──────────── Annual report ────────────
export async function getReport(userId: string, year: number) {
  const start = new Date(year, 0, 1), end = new Date(year + 1, 0, 1)
  const [allTxs, categories] = await Promise.all([getTransactions(userId), getCategories(userId)])
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const txs = allTxs.filter((t) => { const d = new Date(t.date); return d >= start && d < end && !t.parentTransactionId })
  const txsWithCat = txs.map((t) => ({ ...t, category: t.categoryId ? catMap.get(t.categoryId) ?? null : null }))

  const monthlyTrend: { month: string; monthNum: number; income: number; expenses: number; savings: number; netWorth: number }[] = []
  for (let m = 1; m <= 12; m++) {
    const ms = new Date(year, m - 1, 1), me = new Date(year, m, 1)
    const mTxs = txsWithCat.filter((t) => { const d = new Date(t.date); return d >= ms && d < me })
    const income = mTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
    // Count all expenses (fix: previously only counted categorized)
    const expenses = mTxs.filter((t) => t.type === 'EXPENSE' && t.category?.group !== 'SAVING').reduce((s, t) => s + t.amount, 0)
    monthlyTrend.push({ month: monthShort(m), monthNum: m, income, expenses, savings: income - expenses, netWorth: 0 })
  }
  let cumulative = 0
  for (const mt of monthlyTrend) { cumulative += mt.savings; mt.netWorth = cumulative }

  const categoryAgg = new Map<string, { category: string; color: string; icon: string; months: number[] }>()
  for (let m = 1; m <= 12; m++) {
    const ms = new Date(year, m - 1, 1), me = new Date(year, m, 1)
    const mTxs = txsWithCat.filter((t) => { const d = new Date(t.date); return d >= ms && d < me && t.type === 'EXPENSE' && t.category && t.category.group !== 'SAVING' })
    for (const t of mTxs) {
      const key = t.categoryId ?? 'uncat'
      const e = categoryAgg.get(key) ?? { category: t.category?.name ?? 'Uncategorized', color: t.category?.color ?? 'slate', icon: t.category?.icon ?? '📁', months: new Array(12).fill(0) }
      e.months[m - 1] += t.amount
      categoryAgg.set(key, e)
    }
  }
  const categoryHeatmap = Array.from(categoryAgg.values()).map((c) => ({ ...c, total: c.months.reduce((s, v) => s + v, 0) })).sort((a, b) => b.total - a.total).slice(0, 10)

  const totalIncome = monthlyTrend.reduce((s, m) => s + m.income, 0)
  const totalExpenses = monthlyTrend.reduce((s, m) => s + m.expenses, 0)
  const totalSaved = totalIncome - totalExpenses
  const monthsWithData = monthlyTrend.filter((m) => m.income > 0 || m.expenses > 0).length
  const avgMonthlySpending = monthsWithData > 0 ? totalExpenses / monthsWithData : 0
  const withData = monthlyTrend.filter((m) => m.income > 0 || m.expenses > 0)
  const bestMonth = withData.slice().sort((a, b) => b.savings - a.savings)[0]
  const worstMonth = withData.slice().sort((a, b) => a.savings - b.savings)[0]
  const topCategories = categoryHeatmap.map((c) => ({ name: c.category, color: c.color, icon: c.icon, amount: c.total, percent: totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0 }))

  return {
    year, monthlyTrend, categoryHeatmap,
    yearEnd: {
      totalIncome, totalExpenses, totalSaved, avgMonthlySpending,
      bestMonth: bestMonth ? `${bestMonth.month} (+$${bestMonth.savings.toFixed(0)})` : '—',
      worstMonth: worstMonth ? `${worstMonth.month} ($${worstMonth.savings.toFixed(0)})` : '—',
    },
    topCategories,
  }
}
