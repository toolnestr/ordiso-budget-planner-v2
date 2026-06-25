import { db } from '@/lib/db'
import { ok, err, serialize, monthRange } from '@/lib/api'
import type { Category } from '@prisma/client'

export const dynamic = 'force-dynamic'

// GET enriched budget rows for a month: planned, actual, remaining, rolloverIn, progress
export async function GET(req: Request) {
  const url = new URL(req.url)
  const month = Number(url.searchParams.get('month'))
  const year = Number(url.searchParams.get('year'))
  if (!month || !year) return err('month and year are required')

  const { start, end } = monthRange(month, year)

  const [budgets, categories, txs] = await Promise.all([
    db.monthlyBudget.findMany({ where: { month, year }, include: { category: true } }),
    db.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    db.transaction.findMany({ where: { date: { gte: start, lt: end }, parentTransactionId: null }, include: { category: true } }),
  ])

  // Previous month for rollover
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const { start: pStart, end: pEnd } = monthRange(prevMonth, prevYear)
  const [prevBudgets, prevTxs] = await Promise.all([
    db.monthlyBudget.findMany({ where: { month: prevMonth, year: prevYear }, include: { category: true } }),
    db.transaction.findMany({ where: { date: { gte: pStart, lt: pEnd }, parentTransactionId: null }, include: { category: true } }),
  ])

  // Compute actual per category for current month
  const actualMap = new Map<string, number>()
  for (const t of txs) {
    if (!t.categoryId) continue
    actualMap.set(t.categoryId, (actualMap.get(t.categoryId) ?? 0) + (t.type === 'EXPENSE' || t.type === 'INCOME' ? t.amount : 0))
  }
  // Previous month actual for rollover
  const prevActualMap = new Map<string, number>()
  for (const t of prevTxs) {
    if (!t.categoryId) continue
    prevActualMap.set(t.categoryId, (prevActualMap.get(t.categoryId) ?? 0) + t.amount)
  }
  const prevPlannedMap = new Map(prevBudgets.map((b) => [b.categoryId, b.planned]))
  const budgetMap = new Map(budgets.map((b) => [b.categoryId, b.planned]))

  // Build rows for all EXPENSE and INCOME categories
  const rows = categories
    .filter((c: Category) => c.type === 'EXPENSE' || c.type === 'INCOME')
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

  // Summary
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

// Upsert a single budget
export async function PUT(req: Request) {
  const body = await req.json()
  const { month, year, categoryId, planned } = body
  if (!month || !year || !categoryId) return err('month, year, categoryId required')

  const b = await db.monthlyBudget.upsert({
    where: { month_year_categoryId: { month: Number(month), year: Number(year), categoryId } },
    update: { planned: Number(planned) || 0 },
    create: { month: Number(month), year: Number(year), categoryId, planned: Number(planned) || 0 },
    include: { category: true },
  })
  return ok(serialize(b))
}

// Bulk set budgets
export async function POST(req: Request) {
  const body = (await req.json()) as { month: number; year: number; items: { categoryId: string; planned: number }[] }
  if (!body.month || !body.year || !Array.isArray(body.items)) return err('Invalid payload')

  const categoryIds = body.items.map((i) => i.categoryId)
  await db.monthlyBudget.deleteMany({
    where: { month: body.month, year: body.year, categoryId: { notIn: categoryIds } },
  })

  for (const item of body.items) {
    await db.monthlyBudget.upsert({
      where: { month_year_categoryId: { month: body.month, year: body.year, categoryId: item.categoryId } },
      update: { planned: Number(item.planned) || 0 },
      create: { month: body.month, year: body.year, categoryId: item.categoryId, planned: Number(item.planned) || 0 },
    })
  }
  return ok({ success: true })
}
