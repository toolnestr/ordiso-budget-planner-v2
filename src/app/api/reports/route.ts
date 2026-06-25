import { db } from '@/lib/db'
import { ok, serialize, monthRange } from '@/lib/api'
import { monthShort } from '@/lib/format'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const now = new Date()
  const year = Number(url.searchParams.get('year')) || now.getFullYear()

  const start = new Date(year, 0, 1)
  const end = new Date(year + 1, 0, 1)

  const txs = await db.transaction.findMany({
    where: { date: { gte: start, lt: end }, parentTransactionId: null },
    include: { category: true },
  })

  // Monthly trend
  const monthlyTrend: { month: string; monthNum: number; income: number; expenses: number; savings: number; netWorth: number }[] = []
  for (let m = 1; m <= 12; m++) {
    const { start: ms, end: me } = monthRange(m, year)
    const monthTxs = txs.filter((t) => t.date >= ms && t.date < me)
    const income = monthTxs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
    const expenses = monthTxs.filter((t) => t.type === 'EXPENSE' && t.category?.group !== 'SAVING').reduce((s, t) => s + t.amount, 0)
    const savings = income - expenses
    monthlyTrend.push({ month: monthShort(m), monthNum: m, income, expenses, savings, netWorth: 0 })
  }

  // Running net worth (cumulative savings) for visual
  let cumulative = 0
  for (const mt of monthlyTrend) {
    cumulative += mt.savings
    mt.netWorth = cumulative
  }

  // Category heatmap — expense categories x 12 months
  const categoryMap = new Map<string, { category: string; color: string; icon: string; months: number[] }>()
  for (let m = 1; m <= 12; m++) {
    const { start: ms, end: me } = monthRange(m, year)
    const monthTxs = txs.filter((t) => t.date >= ms && t.date < me && t.type === 'EXPENSE' && t.category && t.category.group !== 'SAVING')
    for (const t of monthTxs) {
      const key = t.categoryId ?? 'uncat'
      const existing = categoryMap.get(key) ?? { category: t.category?.name ?? 'Uncategorized', color: t.category?.color ?? 'slate', icon: t.category?.icon ?? '📁', months: new Array(12).fill(0) }
      existing.months[m - 1] += t.amount
      categoryMap.set(key, existing)
    }
  }
  const categoryHeatmap = Array.from(categoryMap.values())
    .map((c) => ({ ...c, total: c.months.reduce((s, v) => s + v, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // Year-end summary
  const totalIncome = monthlyTrend.reduce((s, m) => s + m.income, 0)
  const totalExpenses = monthlyTrend.reduce((s, m) => s + m.expenses, 0)
  const totalSaved = totalIncome - totalExpenses
  const monthsWithData = monthlyTrend.filter((m) => m.income > 0 || m.expenses > 0).length
  const avgMonthlySpending = monthsWithData > 0 ? totalExpenses / monthsWithData : 0
  const bestMonth = monthlyTrend.filter((m) => m.income > 0 || m.expenses > 0).sort((a, b) => b.savings - a.savings)[0]
  const worstMonth = monthlyTrend.filter((m) => m.income > 0 || m.expenses > 0).sort((a, b) => a.savings - b.savings)[0]

  // Top categories overall
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
