'use client'

import { useMemo } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  ArrowDownCircle, ArrowUpCircle, PiggyBank, Wallet, TrendingUp, TrendingDown,
  AlertTriangle, CalendarClock, CheckCircle2, Circle, Banknote, CreditCard, Landmark,
} from 'lucide-react'
import { useDashboard, useUpdateWeeklyCheckin, useSettings } from '@/lib/api-hooks'
import { useBudgetStore } from '@/lib/store'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Currency } from '@/components/budget/currency'
import { StatCard } from '@/components/budget/stat-card'
import { ProgressBar } from '@/components/budget/progress-bar'
import { colorHex, monthName, formatDate, clampPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'

const ACCOUNT_ICONS: Record<string, LucideIcon> = {
  CHECKING: Landmark,
  SAVINGS: PiggyBank,
  CREDIT: CreditCard,
  CASH: Banknote,
}

function ChartTooltipContent({ active, payload, label, currency }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; payload?: { name?: string } }[]; label?: string; currency?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover p-3 shadow-md text-xs">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="font-semibold tabular-nums">{currency}{(entry.value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
        </div>
      ))}
    </div>
  )
}

export function DashboardTab() {
  const { month, year } = useBudgetStore()
  const { data, isLoading } = useDashboard(month, year)
  const { data: settings } = useSettings()
  const updateCheckin = useUpdateWeeklyCheckin()
  const sym = settings?.currencySymbol ?? '$'

  const donutData = useMemo(() => {
    if (!data) return []
    return data.expenseByCategory.filter((c) => c.amount > 0).slice(0, 7).map((c) => ({ name: c.name, value: Math.round(c.amount), color: colorHex(c.color) }))
  }, [data])

  const barData = useMemo(() => data?.incomeVsExpenseTrend ?? [], [data])

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    )
  }

  const savingsRate = data.savingsRate ?? 0
  const leftToSpendPositive = data.leftToSpend >= 0

  const toggleCheckin = (key: 'loggedReceipts' | 'paidBills' | 'reviewedBudget' | 'reconciledAccounts') => {
    const next = !data.weeklyCheckin[key]
    updateCheckin.mutate({ ...data.weeklyCheckin, [key]: next }, {
      onSuccess: () => toast.success(next ? 'Checked off!' : 'Unchecked'),
      onError: (e) => toast.error(e.message),
    })
  }

  const checkinItems: { key: 'loggedReceipts' | 'paidBills' | 'reviewedBudget' | 'reconciledAccounts'; label: string }[] = [
    { key: 'loggedReceipts', label: 'Log all receipts from this week' },
    { key: 'paidBills', label: 'Pay bills due this week' },
    { key: 'reviewedBudget', label: 'Review budget vs. actual' },
    { key: 'reconciledAccounts', label: 'Reconcile account balances' },
  ]

  return (
    <div className="space-y-6">
      {/* Hero summary */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{monthName(month)} Overview</h2>
            <p className="text-sm text-muted-foreground">{data.transactionCount} transactions tracked this month</p>
          </div>
          <div className={cn('rounded-xl px-4 py-2 text-right', leftToSpendPositive ? 'bg-emerald-500/10' : 'bg-rose-500/10')}>
            <p className="text-xs font-medium text-muted-foreground uppercase">Left to Spend</p>
            <p className={cn('text-2xl font-bold tabular-nums', leftToSpendPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              <Currency amount={data.leftToSpend} />
            </p>
          </div>
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Income" value={<Currency amount={data.totalIncome} />} icon={ArrowUpCircle} iconColor="text-emerald-600" sublabel="This month" />
          <StatCard label="Total Expenses" value={<Currency amount={data.totalExpenses} />} icon={ArrowDownCircle} iconColor="text-rose-600" sublabel="Excl. savings" />
          <StatCard label="Net Savings" value={<Currency amount={data.netSavings} sign />} icon={PiggyBank} iconColor="text-primary" sublabel={`${savingsRate.toFixed(0)}% savings rate`} />
          <StatCard label="Net Worth" value={<Currency amount={data.netWorth} compact />} icon={Wallet} iconColor="text-amber-600" sublabel="All accounts" />
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Expense Breakdown</h3>
              <p className="text-xs text-muted-foreground">Where your money goes</p>
            </div>
          </div>
          {donutData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">No expenses yet this month</div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={200} className="max-w-[200px]">
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                    {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltipContent currency={sym} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 w-full space-y-1.5 max-h-[200px] overflow-y-auto scrollbar-thin pr-1">
                {donutData.map((d, i) => {
                  const total = donutData.reduce((s, x) => s + x.value, 0)
                  const pct = total > 0 ? (d.value / total) * 100 : 0
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="truncate">{d.name}</span>
                      </span>
                      <span className="font-medium tabular-nums shrink-0">{pct.toFixed(0)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Income vs Expenses</h3>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Income</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />Expenses</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={45} tickFormatter={(v) => `${sym}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} content={<ChartTooltipContent currency={sym} />} />
              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Accounts + Savings goals */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Account Balances</h3>
          <div className="space-y-3">
            {data.accounts.map((a) => {
              const Icon = ACCOUNT_ICONS[a.type] ?? Banknote
              const negative = a.currentBalance < 0
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-lg p-2" style={{ backgroundColor: `${colorHex(a.color)}1a` }}>
                      <Icon className="h-4 w-4" style={{ color: colorHex(a.color) }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.type.charAt(0) + a.type.slice(1).toLowerCase()}</p>
                    </div>
                  </div>
                  <span className={cn('font-semibold tabular-nums text-sm', negative ? 'text-rose-600 dark:text-rose-400' : '')}>
                    <Currency amount={a.currentBalance} />
                  </span>
                </div>
              )
            })}
            <div className="flex items-center justify-between gap-3 rounded-lg bg-primary/5 p-3 border border-primary/20">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2"><Wallet className="h-4 w-4 text-primary" /></div>
                <p className="font-semibold text-sm">Net Worth</p>
              </div>
              <span className="font-bold tabular-nums text-sm"><Currency amount={data.netWorth} /></span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Savings Goals</h3>
            <Badge variant="secondary" className="text-xs">{data.savingsGoals.length} active</Badge>
          </div>
          <div className="space-y-4 max-h-[280px] overflow-y-auto scrollbar-thin pr-1">
            {data.savingsGoals.map((g) => (
              <div key={g.id}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span>{g.icon}</span>{g.name}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    <Currency amount={g.savedAmount} compact /> / <Currency amount={g.targetAmount} compact />
                  </span>
                </div>
                <ProgressBar value={clampPercent(g.progress)} color={colorHex(g.color)} />
                <p className="text-xs text-muted-foreground mt-1">{g.progress.toFixed(0)}% complete · <Currency amount={g.remaining} /> to go</p>
              </div>
            ))}
            {data.savingsGoals.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No savings goals yet.</p>}
          </div>
        </Card>
      </div>

      {/* Alerts + Weekly checkin */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Quick Glance Alerts</h3>
          <div className="space-y-3">
            {data.billsDueSoon.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />Bills Due Soon</p>
                <div className="space-y-1.5">
                  {data.billsDueSoon.slice(0, 4).map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 text-sm rounded-md bg-muted/50 px-3 py-2">
                      <span className="truncate">{b.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Currency amount={b.amount} className="font-medium" />
                        <Badge variant={b.dueInDays <= 3 ? 'destructive' : 'secondary'} className="text-[10px]">
                          {b.dueInDays === 0 ? 'Today' : b.dueInDays === 1 ? 'Tomorrow' : `${b.dueInDays}d`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.overbudgetCategories.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Over Budget</p>
                <div className="space-y-1.5">
                  {data.overbudgetCategories.slice(0, 3).map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm rounded-md bg-rose-500/5 px-3 py-2">
                      <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorHex(c.color) }} />{c.name}</span>
                      <span className="text-rose-600 dark:text-rose-400 text-xs tabular-nums"><Currency amount={c.spent - c.budget} /> over</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.billsDueSoon.length === 0 && data.overbudgetCategories.length === 0 && (
              <div className="text-center py-6">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium">You&apos;re all caught up!</p>
                <p className="text-xs text-muted-foreground">No bills due soon and no overbudget categories.</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-1">Weekly Check-in</h3>
          <p className="text-xs text-muted-foreground mb-4">A quick Sunday ritual to stay on track</p>
          <div className="space-y-2">
            {checkinItems.map((item) => {
              const done = data.weeklyCheckin[item.key]
              return (
                <button
                  key={item.key}
                  onClick={() => toggleCheckin(item.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent',
                    done && 'bg-emerald-500/5 border-emerald-500/30'
                  )}
                >
                  {done ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
                  <span className={cn(done && 'line-through text-muted-foreground')}>{item.label}</span>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            {checkinItems.filter((i) => data.weeklyCheckin[i.key]).length}/{checkinItems.length} completed this week
          </p>
        </Card>
      </div>
    </div>
  )
}
