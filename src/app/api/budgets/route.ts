import { getWhere, upsertDoc, deleteById } from '@/lib/firestore'
import { ok, err, serialize, monthRange } from '@/lib/api'
import { requireUser } from '@/lib/session'
import type { Category, Transaction, MonthlyBudget } from '@/lib/types'

export const dynamic = 'force-dynamic'

const COLL = 'monthlyBudgets'

function budgetId(userId: string, year: number, month: number, categoryId: string) {
  return `${userId}_${year}_${month}_${categoryId}`
}

export async function GET(req: Request) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const month = Number(url.searchParams.get('month'))
  const year = Number(url.searchParams.get('year'))
  if (!month || !year) return err('month and year are required')

  const { start, end } = monthRange(month, year)

  // Fetch by userId only (single-field, no composite index), filter in memory.
  const [allBudgets, categories, allTxs] = await Promise.all([
    getWhere<MonthlyBudget>(COLL, 'userId', '==', user.userId),
    getWhere<Category>('categories', 'userId', '==', user.userId),
    getWhere<Transaction>('transactions', 'userId', '==', user.userId),
  ])
  const budgets = allBudgets.filter((b) => b.year === year && b.month === month)
  const txs = allTxs.filter((t) => {
    const d = new Date(t.date)
    return d >= start && d < end
  })

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const { start: pStart, end: pEnd } = monthRange(prevMonth, prevYear)
  const prevBudgets = allBudgets.filter((b) => b.year === prevYear && b.month === prevMonth)
  const prevTxs = allTxs.filter((t) => {
    const d = new Date(t.date)
    return d >= pStart && d < pEnd
  })

  const topLevel = (t: Transaction) => !t.parentTransactionId
  const txsTop = txs.filter(topLevel)
  const prevTxsTop = prevTxs.filter(topLevel)

  const actualMap = new Map<string, number>()
  for (const t of txsTop) {
    if (!t.categoryId) continue
    actualMap.set(t.categoryId, (actualMap.get(t.categoryId) ?? 0) + (t.type === 'EXPENSE' || t.type === 'INCOME' ? t.amount : 0))
  }
  const prevActualMap = new Map<string, number>()
  for (const t of prevTxsTop) {
    if (!t.categoryId) continue
    prevActualMap.set(t.categoryId, (prevActualMap.get(t.categoryId) ?? 0) + t.amount)
  }
  const prevPlannedMap = new Map(prevBudgets.map((b) => [b.categoryId, b.planned]))
  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.planned]))

  categories.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''))

  const rows = categories
    .filter((c) => c.type === 'EXPENSE' || c.type === 'INCOME')
    .map((c) => {
      const planned = budgetMap.get(c.id) ?? 0
      const actual = actualMap.get(c.id) ?? 0
      const rolloverIn = c.rollover ? Math.max(0, (prevPlannedMap.get(c.id) ?? 0) - (prevActualMap.get(c.id) ?? 0)) : 0
      const effectiveBudget = planned + rolloverIn
      const remaining = c.type === 'INCOME' ? actual - planned : effectiveBudget - actual
      const progress = effectiveBudget > 0 ? Math.min(150, (actual / effectiveBudget) * 100) : actual > 0 ? 100 : 0
      return {
        categoryId: c.id,
        category: serialize(c),
        planned,
        actual,
        rolloverIn,
        remaining,
        progress,
        hasBudget: planned > 0 || actual > 0,
      }
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

  return ok(serialize({
    rows,
    summary: {
      plannedIncome,
      actualIncome,
      plannedExpenses,
      actualExpenses,
      plannedSavings,
      actualSavings,
      plannedDebt,
      actualDebt,
      leftToSpend: actualIncome - actualExpenses - actualSavings - actualDebt,
      plannedLeftToSpend: plannedIncome - plannedExpenses - plannedSavings - plannedDebt,
    },
  }))
}

export async function PUT(req: Request) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const body = await req.json()
  const { month, year, categoryId, planned } = body
  if (!month || !year || !categoryId) return err('month, year, categoryId required')

  const id = budgetId(user.userId, Number(year), Number(month), categoryId)
  const b = await upsertDoc<MonthlyBudget & { userId: string }>(COLL, id, {
    userId: user.userId,
    month: Number(month),
    year: Number(year),
    categoryId,
    planned: Number(planned) || 0,
  })
  return ok(serialize(b))
}

export async function POST(req: Request) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)
  const body = (await req.json()) as { month: number; year: number; items: { categoryId: string; planned: number }[] }
  if (!body.month || !body.year || !Array.isArray(body.items)) return err('Invalid payload')

  const existing = await getWhere<MonthlyBudget>(COLL, 'userId', '==', user.userId)
  const keepIds = new Set(body.items.map((i) => i.categoryId))
  for (const b of existing.filter((x) => x.year === body.year && x.month === body.month)) {
    if (!keepIds.has(b.categoryId)) await deleteById(COLL, b.id)
  }

  for (const item of body.items) {
    const id = budgetId(user.userId, body.year, body.month, item.categoryId)
    await upsertDoc<MonthlyBudget & { userId: string }>(COLL, id, {
      userId: user.userId,
      month: body.month,
      year: body.year,
      categoryId: item.categoryId,
      planned: Number(item.planned) || 0,
    })
  }
  return ok({ success: true })
}
