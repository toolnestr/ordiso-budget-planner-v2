import { getWhere } from '@/lib/firestore'
import { ok, serialize, monthRange } from '@/lib/api'
import { requireUser } from '@/lib/session'
import { monthShort } from '@/lib/format'
import type { Transaction, Category } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const user = await requireUser()
  if (!user) return ok({ unauthorized: true }, { status: 401 })

  const url = new URL(req.url)
  const now = new Date()
  const year = Number(url.searchParams.get('year')) || now.getFullYear()

  const start = new Date(year, 0, 1)
  const end = new Date(year + 1, 0, 1)

  // Fetch by userId only (single-field, no composite index), filter by year in memory.
  const [allTxs, categories] = await Promise.all([
    getWhere<Transaction>('transactions', 'userId', '==', user.userId),
    getWhere<Category>('categories', 'userId', '==', user.userId),
  ])
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const txs = allTxs.filter((t) => {
    const d = new Date(t.date)
    return d >= start && d < end
  })
  const topOnly = txs.filter((t) => !t.parentTransactionId)
  const txsWithCat = topOnly.map((t) => ({ ...t, category: t.categoryId ? catMap.get(t.categoryId) ?? null : null }))

  const monthlyTrend: { month: string; monthNum: number; income: number; expenses: number; savings: number; netWorth: number }[] = []
  for (let m = 1; m <= 12; m++) {
    const { start: ms, end: me } = monthRange(m, year)
    const monthTxs = txsWithCat.filter((t) => {
      const d = new Date(t.date)
      return d >= ms && d < me
    })
    const income = monthTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
    const expenses = monthTxs.filter((t) => t.type === 'EXPENSE' && t.category?.group !== 'SAVING').reduce((s, t) => s + t.amount, 0)
    monthlyTrend.push({ month: monthShort(m), monthNum: m, income, expenses, savings: income - expenses, netWorth: 0 })
  }

  let cumulative = 0
  for (const mt of monthlyTrend) {
    cumulative += mt.savings
    mt.netWorth = cumulative
  }

  const categoryAgg = new Map<string, { category: string; color: string; icon: string; months: number[] }>()
  for (let m = 1; m <= 12; m++) {
    const { start: ms, end: me } = monthRange(m, year)
    const monthTxs = txsWithCat.filter((t) => {
      const d = new Date(t.date)
      return d >= ms && d < me && t.type === 'EXPENSE' && t.category && t.category.group !== 'SAVING'
    })
    for (const t of monthTxs) {
      const key = t.categoryId ?? 'uncat'
      const existing = categoryAgg.get(key) ?? { category: t.category?.name ?? 'Uncategorized', color: t.category?.color ?? 'slate', icon: t.category?.icon ?? '📁', months: new Array(12).fill(0) }
      existing.months[m - 1] += t.amount
      categoryAgg.set(key, existing)
    }
  }
  const categoryHeatmap = Array.from(categoryAgg.values())
    .map((c) => ({ ...c, total: c.months.reduce((s, v) => s + v, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const totalIncome = monthlyTrend.reduce((s, m) => s + m.income, 0)
  const totalExpenses = monthlyTrend.reduce((s, m) => s + m.expenses, 0)
  const totalSaved = totalIncome - totalExpenses
  const monthsWithData = monthlyTrend.filter((m) => m.income > 0 || m.expenses > 0).length
  const avgMonthlySpending = monthsWithData > 0 ? totalExpenses / monthsWithData : 0
  const withData = monthlyTrend.filter((m) => m.income > 0 || m.expenses > 0)
  const bestMonth = withData.slice().sort((a, b) => b.savings - a.savings)[0]
  const worstMonth = withData.slice().sort((a, b) => a.savings - b.savings)[0]

  const topCategories = categoryHeatmap.map((c) => ({ name: c.category, color: c.color, icon: c.icon, amount: c.total, percent: totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0 }))

  return ok(serialize({
    year,
    monthlyTrend,
    categoryHeatmap,
    yearEnd: {
      totalIncome,
      totalExpenses,
      totalSaved,
      avgMonthlySpending,
      bestMonth: bestMonth ? `${bestMonth.month} (+$${bestMonth.savings.toFixed(0)})` : '—',
      worstMonth: worstMonth ? `${worstMonth.month} ($${worstMonth.savings.toFixed(0)})` : '—',
    },
    topCategories,
  }))
}
