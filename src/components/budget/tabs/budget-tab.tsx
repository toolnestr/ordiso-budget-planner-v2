'use client'

import { Fragment, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  PiggyBank,
  CreditCard,
  Lock,
  ShoppingBag,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Plus,
} from 'lucide-react'
import { useBudget, useUpdateBudget } from '@/lib/api-hooks'
import { useBudgetStore } from '@/lib/store'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Currency } from '@/components/budget/currency'
import { ProgressBar } from '@/components/budget/progress-bar'
import { colorHex, monthName, COLOR_MAP } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'
import type { MonthlyBudgetRow, Category } from '@/lib/types'

const ROSE_HEX = COLOR_MAP.rose

interface GroupDef {
  id: string
  title: string
  description: string
  icon: LucideIcon
  accent: string
  bg: string
  barColor: string
  filter: (row: MonthlyBudgetRow) => boolean
}

const GROUPS: GroupDef[] = [
  {
    id: 'income',
    title: 'Income',
    description: 'Money coming in this month',
    icon: ArrowDownCircle,
    accent: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    barColor: COLOR_MAP.emerald,
    filter: (r) => r.category.type === 'INCOME',
  },
  {
    id: 'fixed',
    title: 'Fixed Expenses',
    description: 'Bills that stay the same each month',
    icon: Lock,
    accent: 'text-slate-600 dark:text-slate-300',
    bg: 'bg-slate-500/10',
    barColor: COLOR_MAP.slate,
    filter: (r) => r.category.type === 'EXPENSE' && r.category.group === 'FIXED',
  },
  {
    id: 'variable',
    title: 'Variable Expenses',
    description: 'Spending that fluctuates',
    icon: ShoppingBag,
    accent: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    barColor: COLOR_MAP.amber,
    filter: (r) => r.category.type === 'EXPENSE' && r.category.group === 'VARIABLE',
  },
  {
    id: 'savings',
    title: 'Sinking Funds',
    description: 'Saving for future goals',
    icon: PiggyBank,
    accent: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-500/10',
    barColor: COLOR_MAP.teal,
    filter: (r) => r.category.type === 'EXPENSE' && r.category.group === 'SAVING',
  },
  {
    id: 'debt',
    title: 'Debt Payments',
    description: 'Paying down what you owe',
    icon: CreditCard,
    accent: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10',
    barColor: COLOR_MAP.rose,
    filter: (r) => r.category.type === 'EXPENSE' && r.category.group === 'DEBT',
  },
]

// ---------- helpers ----------

function effectiveBudget(row: MonthlyBudgetRow): number {
  return (row.planned ?? 0) + (row.rolloverIn ?? 0)
}

function isOverBudget(row: MonthlyBudgetRow): boolean {
  const eff = effectiveBudget(row)
  return eff > 0 && row.actual > eff
}

function groupLabel(row: MonthlyBudgetRow): string {
  if (row.category.type === 'INCOME') return 'Income'
  const g = row.category.group
  return g.charAt(0) + g.slice(1).toLowerCase()
}

interface Subtotal {
  planned: number
  actual: number
  remaining: number
}

function subtotal(rows: MonthlyBudgetRow[]): Subtotal {
  return rows.reduce(
    (acc, r) => ({
      planned: acc.planned + (r.planned ?? 0),
      actual: acc.actual + (r.actual ?? 0),
      remaining: acc.remaining + (r.remaining ?? 0),
    }),
    { planned: 0, actual: 0, remaining: 0 }
  )
}

// ---------- sub-components ----------

function CategoryIcon({
  category,
  className,
}: {
  category: Category
  className?: string
}) {
  const hex = colorHex(category.color)
  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full text-base shrink-0',
        className
      )}
      style={{ backgroundColor: `${hex}1a`, color: hex, boxShadow: `inset 0 0 0 1px ${hex}33` }}
      aria-hidden
    >
      <span>{category.icon || '💸'}</span>
    </span>
  )
}

function PlannedInput({
  row,
  month,
  year,
}: {
  row: MonthlyBudgetRow
  month: number
  year: number
}) {
  const updateBudget = useUpdateBudget()
  const [value, setValue] = useState<string>(String(row.planned ?? 0))
  const [focused, setFocused] = useState(false)
  const [lastServerPlanned, setLastServerPlanned] = useState<number>(row.planned ?? 0)

  const isSaving =
    updateBudget.isPending && updateBudget.variables?.categoryId === row.category.id

  // Sync local input with server value when not actively editing.
  // React-recommended pattern: adjust state during render by tracking the
  // previous prop value (avoids setState-in-effect cascading renders).
  if (!focused && row.planned !== lastServerPlanned) {
    setLastServerPlanned(row.planned ?? 0)
    setValue(String(row.planned ?? 0))
  }

  const commit = () => {
    setFocused(false)
    const trimmed = value.trim()
    const num = parseFloat(trimmed)
    if (trimmed === '' || isNaN(num) || num < 0 || !isFinite(num)) {
      setValue(String(row.planned ?? 0))
      return
    }
    if (num === row.planned) return
    updateBudget.mutate(
      { month, year, categoryId: row.category.id, planned: num },
      {
        onSuccess: () =>
          toast.success(`Updated ${row.category.name}`, {
            description: `Planned amount set to ${num.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
          }),
        onError: (e) => {
          toast.error('Could not update budget', { description: e.message })
          setValue(String(row.planned ?? 0))
        },
      }
    )
  }

  return (
    <Input
      type="number"
      min={0}
      step="any"
      inputMode="decimal"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => {
        setFocused(true)
        e.target.select()
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          setValue(String(row.planned ?? 0))
          e.currentTarget.blur()
        }
      }}
      disabled={isSaving}
      aria-label={`Planned amount for ${row.category.name}`}
      className={cn(
        'h-8 w-24 text-right tabular-nums text-sm',
        isSaving && 'opacity-60'
      )}
    />
  )
}

function RolloverBadge({ row }: { row: MonthlyBudgetRow }) {
  if (!row.rolloverIn || row.rolloverIn <= 0) return null
  return (
    <Badge
      variant="outline"
      className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-0.5"
    >
      +<Currency amount={row.rolloverIn} compact /> rollover
    </Badge>
  )
}

function RemainingCell({ row }: { row: MonthlyBudgetRow }) {
  const positive = row.remaining >= 0
  return (
    <Currency
      amount={row.remaining}
      className={cn(
        'font-semibold tabular-nums',
        positive
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-rose-600 dark:text-rose-400'
      )}
    />
  )
}

function RowProgress({ row }: { row: MonthlyBudgetRow }) {
  const over = isOverBudget(row)
  const color = over ? ROSE_HEX : colorHex(row.category.color)
  const pct = row.progress ?? 0
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <ProgressBar value={pct} color={color} className="flex-1" />
      <span
        className={cn(
          'text-xs font-medium tabular-nums w-10 text-right shrink-0',
          over ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
        )}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

function SummaryCard({
  label,
  icon: Icon,
  accentText,
  accentBg,
  planned,
  actual,
  barColor,
  overIsGood = false,
}: {
  label: string
  icon: LucideIcon
  accentText: string
  accentBg: string
  planned: number
  actual: number
  barColor: string
  overIsGood?: boolean
}) {
  const pct = planned > 0 ? (actual / planned) * 100 : actual > 0 ? 100 : 0
  const exceeds = planned > 0 && actual > planned
  const isBad = exceeds && !overIsGood
  const isGood = exceeds && overIsGood
  return (
    <Card className="p-4 gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className={cn('rounded-md p-1', accentBg)}>
            <Icon className={cn('h-3.5 w-3.5', accentText)} />
          </span>
          {label}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          of <Currency amount={planned} compact />
        </span>
      </div>
      <div
        className={cn(
          'text-2xl font-bold tabular-nums tracking-tight',
          isBad && 'text-rose-600 dark:text-rose-400',
          isGood && 'text-emerald-600 dark:text-emerald-400'
        )}
      >
        <Currency amount={actual} />
      </div>
      <div className="flex items-center gap-2">
        <ProgressBar value={pct} color={isBad ? ROSE_HEX : barColor} height="h-1.5" />
        <span
          className={cn(
            'text-[10px] font-semibold tabular-nums w-9 text-right',
            isBad ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'
          )}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
    </Card>
  )
}

// ---------- skeleton ----------

function BudgetTabSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-36 rounded-2xl" />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[420px] rounded-xl" />
    </div>
  )
}

// ---------- main component ----------

export function BudgetTab() {
  const { month, year, setActiveTab } = useBudgetStore()
  const { data, isLoading, isError, error } = useBudget(month, year)

  const summary = (data?.summary ?? {}) as Record<string, number>
  const num = (k: string) => (typeof summary[k] === 'number' ? summary[k] : 0)

  const leftToSpend = num('leftToSpend')
  const plannedLeftToSpend = num('plannedLeftToSpend')
  const plannedIncome = num('plannedIncome')
  const actualIncome = num('actualIncome')
  const plannedExpenses = num('plannedExpenses')
  const actualExpenses = num('actualExpenses')
  const plannedSavings = num('plannedSavings')
  const actualSavings = num('actualSavings')
  const plannedDebt = num('plannedDebt')
  const actualDebt = num('actualDebt')

  const rows = data?.rows ?? []

  const grouped = useMemo(() => {
    return GROUPS.map((g) => ({
      group: g,
      rows: rows
        .filter(g.filter)
        .sort((a, b) => a.category.sortOrder - b.category.sortOrder),
    })).filter((g) => g.rows.length > 0)
  }, [rows])

  const totals = useMemo(() => {
    const incomeRows = rows.filter((r) => r.category.type === 'INCOME')
    const expenseRows = rows.filter((r) => r.category.type === 'EXPENSE')
    return {
      income: subtotal(incomeRows),
      expenses: subtotal(expenseRows),
    }
  }, [rows])

  if (isLoading) {
    return <BudgetTabSkeleton />
  }

  if (isError) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-3" />
        <p className="font-semibold">Couldn&apos;t load your budget</p>
        <p className="text-sm text-muted-foreground mt-1">
          {(error as Error)?.message ?? 'Unknown error'}
        </p>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <Card className="p-10 text-center">
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">No categories yet</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md mx-auto">
          Head over to the Setup tab to create your income sources and expense
          categories. Then come back here to give every dollar a job.
        </p>
        <Button onClick={() => setActiveTab('setup')}>
          <Plus className="h-4 w-4 mr-1" /> Go to Setup
        </Button>
      </Card>
    )
  }

  const leftPositive = leftToSpend >= 0
  const nearZero = Math.abs(leftToSpend) < 0.5
  const monthLabel = `${monthName(month)} ${year}`

  return (
    <div className="space-y-6">
      {/* HERO: Left to Spend */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {monthLabel} · Zero-Based Budget
            </p>
            <h2 className="text-2xl font-bold tracking-tight">Left to Spend</h2>
            <p className="text-sm text-muted-foreground">
              Planned left to spend:{' '}
              <Currency amount={plannedLeftToSpend} className="font-medium text-foreground" />
            </p>
          </div>
          <div className="text-right ml-auto">
            <motion.div
              key={leftToSpend}
              initial={{ opacity: 0.6, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={cn(
                'text-4xl sm:text-5xl font-bold tabular-nums tracking-tight leading-none',
                leftPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              )}
            >
              <Currency amount={leftToSpend} />
            </motion.div>
            <div className="mt-3 flex justify-end">
              {nearZero ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Every dollar has a job
                </span>
              ) : leftPositive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <Currency amount={leftToSpend} compact /> unassigned
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="h-3.5 w-3.5" /> Over budget
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY ROW */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Income"
          icon={ArrowDownCircle}
          accentText="text-emerald-600 dark:text-emerald-400"
          accentBg="bg-emerald-500/10"
          planned={plannedIncome}
          actual={actualIncome}
          barColor={COLOR_MAP.emerald}
          overIsGood
        />
        <SummaryCard
          label="Expenses"
          icon={ArrowUpCircle}
          accentText="text-rose-600 dark:text-rose-400"
          accentBg="bg-rose-500/10"
          planned={plannedExpenses}
          actual={actualExpenses}
          barColor={COLOR_MAP.rose}
        />
        <SummaryCard
          label="Savings"
          icon={PiggyBank}
          accentText="text-teal-600 dark:text-teal-400"
          accentBg="bg-teal-500/10"
          planned={plannedSavings}
          actual={actualSavings}
          barColor={COLOR_MAP.teal}
          overIsGood
        />
        <SummaryCard
          label="Debt"
          icon={CreditCard}
          accentText="text-amber-600 dark:text-amber-400"
          accentBg="bg-amber-500/10"
          planned={plannedDebt}
          actual={actualDebt}
          barColor={COLOR_MAP.amber}
          overIsGood
        />
      </div>

      {/* BUDGET TABLE — desktop */}
      <Card className="p-0 overflow-hidden gap-0">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="pl-4 w-[32%]">Category</TableHead>
                <TableHead className="text-right">Planned</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-center">Rollover</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="pr-4 w-[18%]">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map(({ group, rows: gRows }) => {
                const sub = subtotal(gRows)
                return (
                  <Fragment key={group.id}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40 border-y">
                      <TableCell colSpan={6} className="py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className={cn('rounded-md p-1 shrink-0', group.bg)}>
                              <group.icon className={cn('h-3.5 w-3.5', group.accent)} />
                            </span>
                            <span className="font-semibold text-sm">{group.title}</span>
                            <span className="text-xs text-muted-foreground hidden lg:inline truncate">
                              · {group.description}
                            </span>
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            <Currency amount={sub.planned} compact /> planned ·{' '}
                            <Currency amount={sub.actual} compact /> actual
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {gRows.map((row) => {
                      const over = isOverBudget(row)
                      return (
                        <TableRow
                          key={row.category.id}
                          className={cn(
                            'transition-colors',
                            over
                              ? 'bg-rose-500/5 hover:bg-rose-500/10'
                              : 'hover:bg-muted/40'
                          )}
                        >
                          <TableCell className="pl-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <CategoryIcon category={row.category} />
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {row.category.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {groupLabel(row)}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end">
                              <PlannedInput row={row} month={month} year={year} />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Currency
                              amount={row.actual}
                              className={cn(
                                'tabular-nums font-medium',
                                row.category.type === 'INCOME' &&
                                  'text-emerald-600 dark:text-emerald-400'
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <RolloverBadge row={row} />
                          </TableCell>
                          <TableCell className="text-right">
                            <RemainingCell row={row} />
                          </TableCell>
                          <TableCell className="pr-4">
                            <RowProgress row={row} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </Fragment>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableCell className="pl-4 font-semibold">Total Income</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  <Currency amount={totals.income.planned} />
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  <Currency amount={totals.income.actual} />
                </TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums">
                  <Currency amount={totals.income.remaining} />
                </TableCell>
                <TableCell className="pr-4" />
              </TableRow>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableCell className="pl-4 font-semibold">Total Expenses</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  <Currency amount={totals.expenses.planned} />
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                  <Currency amount={totals.expenses.actual} />
                </TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums">
                  <Currency amount={totals.expenses.remaining} />
                </TableCell>
                <TableCell className="pr-4" />
              </TableRow>
              <TableRow className="bg-primary/5 hover:bg-primary/5 border-t-2">
                <TableCell className="pl-4 font-bold">Net Position</TableCell>
                <TableCell className="text-right font-bold tabular-nums">
                  <Currency amount={plannedLeftToSpend} />
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-bold tabular-nums',
                    leftPositive
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  <Currency amount={leftToSpend} />
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="pr-4" />
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* BUDGET LIST — mobile cards */}
        <div className="md:hidden divide-y">
          {grouped.map(({ group, rows: gRows }) => {
            const sub = subtotal(gRows)
            return (
              <div key={group.id} className="py-3">
                <div className="flex items-center justify-between gap-2 mx-3 px-3 py-2 mb-1 rounded-md bg-muted/50">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={cn('rounded-md p-1 shrink-0', group.bg)}>
                      <group.icon className={cn('h-3.5 w-3.5', group.accent)} />
                    </span>
                    <span className="font-semibold text-sm truncate">{group.title}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    <Currency amount={sub.actual} compact /> /{' '}
                    <Currency amount={sub.planned} compact />
                  </span>
                </div>
                <div className="space-y-2 px-2">
                  {gRows.map((row) => {
                    const over = isOverBudget(row)
                    return (
                      <div
                        key={row.category.id}
                        className={cn(
                          'rounded-xl border p-3 space-y-2',
                          over
                            ? 'bg-rose-500/5 border-rose-500/20'
                            : 'bg-card'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <CategoryIcon category={row.category} className="h-8 w-8" />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">
                                {row.category.name}
                              </p>
                              {row.rolloverIn > 0 && (
                                <div className="mt-0.5">
                                  <RolloverBadge row={row} />
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] uppercase text-muted-foreground">
                              Remaining
                            </p>
                            <RemainingCell row={row} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-end">
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground mb-1">
                              Planned
                            </p>
                            <PlannedInput row={row} month={month} year={year} />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground mb-1">
                              Actual
                            </p>
                            <p
                              className={cn(
                                'text-sm font-semibold tabular-nums h-8 flex items-center',
                                row.category.type === 'INCOME' &&
                                  'text-emerald-600 dark:text-emerald-400'
                              )}
                            >
                              <Currency amount={row.actual} />
                            </p>
                          </div>
                        </div>
                        <RowProgress row={row} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Mobile totals */}
        <div className="md:hidden border-t px-4 py-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Total Income</span>
            <span className="tabular-nums">
              <Currency amount={totals.income.actual} /> /{' '}
              <Currency amount={totals.income.planned} />
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Total Expenses</span>
            <span className="tabular-nums">
              <Currency amount={totals.expenses.actual} /> /{' '}
              <Currency amount={totals.expenses.planned} />
            </span>
          </div>
          <div className="flex items-center justify-between text-sm pt-2 border-t">
            <span className="font-bold">Net Position</span>
            <span
              className={cn(
                'font-bold tabular-nums',
                leftPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              )}
            >
              <Currency amount={leftToSpend} />
            </span>
          </div>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground text-center px-4">
        Tip: edit any{' '}
        <span className="font-medium text-foreground">Planned</span> value to give
        every dollar a job. Changes save automatically when you press Enter or click
        away.
      </p>
    </div>
  )
}
