'use client'

import { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ArrowDownCircle, ArrowUpCircle, PiggyBank, TrendingUp, TrendingDown,
  ChevronLeft, ChevronRight, Award, Sparkles, CalendarDays,
} from 'lucide-react'
import { useReports, useSettings } from '@/lib/api-hooks'
import { useBudgetStore } from '@/lib/store'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Currency } from '@/components/budget/currency'
import { StatCard } from '@/components/budget/stat-card'
import { colorHex, monthShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AnnualReportData } from '@/lib/types'

const MIN_YEAR = 2020
const MAX_YEAR = new Date().getFullYear() + 1
const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => monthShort(i + 1))

// ---- helpers --------------------------------------------------------------

function alphaColor(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${a}`
}

/** Compact money for tight UI (heatmap cells). "$420", "$1.2k", "$3M". */
function cellMoney(v: number, sym: string): string {
  if (v === 0) return '·'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (abs >= 1000) return `${sign}${sym}${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `${sign}${sym}${Math.round(abs)}`
}

// ---- chart tooltip (matches dashboard-tab pattern) ------------------------

function ChartTooltipContent({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string }[]
  label?: string
  currency?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover p-3 shadow-md text-xs">
      {label && <p className="font-medium mb-1.5">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="font-semibold tabular-nums">
            {currency}
            {(entry.value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---- year selector --------------------------------------------------------

function YearSelector({
  year,
  onPrev,
  onNext,
}: {
  year: number
  onPrev: () => void
  onNext: () => void
}) {
  const atMin = year <= MIN_YEAR
  const atMax = year >= MAX_YEAR
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={onPrev}
        disabled={atMin}
        aria-label="Previous year"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="rounded-lg border bg-card px-4 py-1.5 min-w-[110px] text-center">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Annual Review</p>
        <p className="text-lg font-bold tabular-nums leading-tight">{year}</p>
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={onNext}
        disabled={atMax}
        aria-label="Next year"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ---- heatmap table --------------------------------------------------------

function HeatmapTable({
  rows,
  currency,
}: {
  rows: AnnualReportData['categoryHeatmap']
  currency: string
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No expense data to heat-map for this year.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto scrollbar-thin -mx-1 px-1">
      <table className="w-full border-collapse text-sm min-w-[860px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 bg-card text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-2 py-2 min-w-[150px] border-b">
              Category
            </th>
            {MONTH_LABELS.map((m, i) => (
              <th
                key={i}
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-1 py-2 text-center min-w-[58px] border-b"
              >
                {m}
              </th>
            ))}
            <th className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-2 py-2 text-right min-w-[78px] border-b">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const max = Math.max(...row.months, 1)
            const total = row.months.reduce((s, v) => s + v, 0)
            const hex = colorHex(row.color)
            return (
              <tr key={ri} className="group">
                <td className="sticky left-0 z-10 bg-card group-hover:bg-accent/40 transition-colors px-2 py-1.5 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm"
                      style={{ backgroundColor: alphaColor(hex, 0.15) }}
                    >
                      {row.icon}
                    </span>
                    <span className="font-medium truncate">{row.category}</span>
                  </div>
                </td>
                {row.months.map((val, mi) => {
                  const ratio = val / max
                  const intensity = val > 0 ? 0.12 + 0.88 * ratio : 0
                  const bg = val > 0 ? alphaColor(hex, intensity) : 'transparent'
                  const isHigh = intensity > 0.55
                  return (
                    <td
                      key={mi}
                      className="px-1 py-1 border-b border-border/40 text-center align-middle"
                      style={{ backgroundColor: bg }}
                      title={`${MONTH_LABELS[mi]} · ${row.category}: ${currency}${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                    >
                      <span
                        className={cn(
                          'text-[11px] tabular-nums whitespace-nowrap',
                          val === 0
                            ? 'text-muted-foreground/30'
                            : isHigh
                              ? 'text-white font-medium'
                              : 'text-foreground/85'
                        )}
                      >
                        {cellMoney(val, currency)}
                      </span>
                    </td>
                  )
                })}
                <td className="px-2 py-1.5 border-b border-border/60 text-right">
                  <span className="text-xs font-semibold tabular-nums">
                    <Currency amount={total} compact />
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---- top categories list --------------------------------------------------

function TopCategoriesList({ items }: { items: AnnualReportData['topCategories'] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No expense categories tracked this year.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {items.map((c, i) => {
        const hex = colorHex(c.color)
        return (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium min-w-0">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm"
                  style={{ backgroundColor: alphaColor(hex, 0.15) }}
                >
                  {c.icon}
                </span>
                <span className="truncate">{c.name}</span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <Currency amount={c.amount} compact className="text-sm font-semibold" />
                <Badge
                  variant="secondary"
                  className="text-[11px] tabular-nums"
                  style={{ color: hex, backgroundColor: alphaColor(hex, 0.12) }}
                >
                  {c.percent.toFixed(0)}%
                </Badge>
              </div>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(3, Math.min(100, c.percent))}%`,
                  backgroundColor: hex,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---- main component -------------------------------------------------------

export function ReportsTab() {
  const store = useBudgetStore()
  const { data: settings } = useSettings()
  const [year, setYear] = useState<number>(store.year)
  const { data, isLoading } = useReports(year)
  const sym = settings?.currencySymbol ?? '$'

  const trendData = useMemo(() => data?.monthlyTrend ?? [], [data])
  const heatmap = useMemo(() => data?.categoryHeatmap ?? [], [data])
  const topCategories = useMemo(() => data?.topCategories ?? [], [data])
  const yearEnd = data?.yearEnd

  const hasNetWorth = useMemo(
    () => trendData.some((m) => (m.netWorth ?? 0) !== 0),
    [trendData]
  )

  const hasData = useMemo(() => {
    if (!yearEnd) return false
    return (
      yearEnd.totalIncome > 0 ||
      yearEnd.totalExpenses > 0 ||
      yearEnd.totalSaved !== 0
    )
  }, [yearEnd])

  const savingsRate =
    yearEnd && yearEnd.totalIncome > 0
      ? (yearEnd.totalSaved / yearEnd.totalIncome) * 100
      : 0

  const goPrev = () => setYear((y) => Math.max(MIN_YEAR, y - 1))
  const goNext = () => setYear((y) => Math.min(MAX_YEAR, y + 1))

  // ----- loading skeleton -----
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64 rounded-full" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  // ----- empty state -----
  if (!data || !hasData) {
    return (
      <div className="space-y-6">
        <YearSelector year={year} onPrev={goPrev} onNext={goNext} />
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted/60 p-4 mb-4">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No data for {year}</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Try another year or add transactions to see your annual review come to life.
          </p>
        </Card>
      </div>
    )
  }

  // ----- main render -----
  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <YearSelector year={year} onPrev={goPrev} onNext={goNext} />
        <p className="text-xs text-muted-foreground hidden sm:block">
          The big picture · 12-month view
        </p>
      </div>

      {/* Year-end summary hero */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{year} Year in Review</h2>
            <p className="text-sm text-muted-foreground">
              The big picture across all 12 months
            </p>
          </div>
          <Award className="h-6 w-6 text-primary hidden sm:block" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Total Income"
            value={<Currency amount={yearEnd.totalIncome} compact />}
            icon={ArrowUpCircle}
            iconColor="text-emerald-600"
            sublabel="Across 12 months"
          />
          <StatCard
            label="Total Expenses"
            value={<Currency amount={yearEnd.totalExpenses} compact />}
            icon={ArrowDownCircle}
            iconColor="text-rose-600"
            sublabel="All categories"
          />
          <StatCard
            label="Total Saved"
            value={<Currency amount={yearEnd.totalSaved} compact sign />}
            icon={PiggyBank}
            iconColor="text-primary"
            sublabel={`${savingsRate.toFixed(0)}% savings rate`}
          />
          <StatCard
            label="Avg Monthly Spending"
            value={<Currency amount={yearEnd.avgMonthlySpending} compact />}
            icon={TrendingUp}
            iconColor="text-amber-600"
            sublabel="Per-month average"
          />
          <StatCard
            label="Best Month"
            value={
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 text-sm px-3 py-1">
                {yearEnd.bestMonth}
              </Badge>
            }
            icon={Award}
            iconColor="text-emerald-600"
            sublabel="Highest net savings"
          />
          <StatCard
            label="Worst Month"
            value={
              <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 hover:bg-rose-500/20 text-sm px-3 py-1">
                {yearEnd.worstMonth}
              </Badge>
            }
            icon={TrendingDown}
            iconColor="text-rose-600"
            sublabel="Lowest net savings"
          />
        </div>
      </div>

      {/* Income vs Expenses trend */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">Income vs Expenses — Full Year</h3>
            <p className="text-xs text-muted-foreground">
              Monthly flow across all 12 months
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Income
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              Expenses
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
              Savings
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={trendData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="grad-income" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="grad-expenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="grad-savings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={12}
              width={48}
              tickFormatter={(v) =>
                `${sym}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
              }
            />
            <Tooltip
              cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
              content={<ChartTooltipContent currency={sym} />}
            />
            <Area
              type="monotone"
              dataKey="income"
              name="Income"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#grad-income)"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke="#f43f5e"
              strokeWidth={2}
              fill="url(#grad-expenses)"
            />
            <Area
              type="monotone"
              dataKey="savings"
              name="Savings"
              stroke="#14b8a6"
              strokeWidth={2}
              fill="url(#grad-savings)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Category heatmap */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">Spending Heatmap by Category</h3>
            <p className="text-xs text-muted-foreground">
              Where each category spiked — darker means more spent
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {heatmap.length} categories
          </Badge>
        </div>
        <HeatmapTable rows={heatmap} currency={sym} />
        <p className="text-[11px] text-muted-foreground mt-3">
          Each cell shows that month&apos;s spend. Color intensity scales relative to the
          category&apos;s busiest month.
        </p>
      </Card>

      {/* Bottom row: top categories + net worth */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Where Your Money Went</h3>
              <p className="text-xs text-muted-foreground">
                Top spending categories this year
              </p>
            </div>
          </div>
          <TopCategoriesList items={topCategories} />
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Net Worth Trajectory</h3>
              <p className="text-xs text-muted-foreground">
                Cumulative growth across the year
              </p>
            </div>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          {hasNetWorth ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="grad-networth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={48}
                  tickFormatter={(v) =>
                    `${sym}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                  }
                />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                  content={<ChartTooltipContent currency={sym} />}
                />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  name="Net Worth"
                  stroke="#14b8a6"
                  strokeWidth={2.5}
                  fill="url(#grad-networth)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[260px] flex flex-col items-center justify-center text-center text-sm text-muted-foreground">
              <CalendarDays className="h-8 w-8 text-muted-foreground/50 mb-2" />
              No net worth data for {year}.
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
