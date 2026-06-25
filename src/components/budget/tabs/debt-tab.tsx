'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CreditCard, Plus, Snowflake, TrendingDown, Pencil, Trash2, CalendarClock,
  PartyPopper, CheckCircle2, Flame, DollarSign, Landmark,
} from 'lucide-react'
import {
  useDebts, useCreateDebt, useUpdateDebt, useDeleteDebt, useDebtPayment,
} from '@/lib/api-hooks'
import type { Debt, DebtStrategy } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Currency } from '@/components/budget/currency'
import { StatCard } from '@/components/budget/stat-card'
import { formatDate, clampPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ----- Local types ----------------------------------------------------------
// The API returns each Debt with a `payments` array (see /api/debts route.ts);
// the shared `Debt` type omits it, so we extend locally.
type DebtPaymentRow = { id: string; date: string; amount: number; note: string | null }
type LoadedDebt = Debt & { payments?: DebtPaymentRow[] }

type StrategyView = 'SNOWBALL' | 'AVALANCHE'

// ----- Payoff calculation (per task spec) -----------------------------------
function computePayoff(
  balance: number,
  annualRate: number,
  payment: number,
): { months: number | null; totalInterest: number | null } {
  if (balance <= 0 || payment <= 0) {
    return { months: balance <= 0 ? 0 : null, totalInterest: 0 }
  }
  const r = annualRate / 100 / 12
  if (r === 0) return { months: Math.ceil(balance / payment), totalInterest: 0 }
  const interestFirst = balance * r
  if (payment <= interestFirst) return { months: null, totalInterest: null }
  const months = Math.ceil(
    Math.log(payment / (payment - balance * r)) / Math.log(1 + r),
  )
  let b = balance
  let totalInterest = 0
  for (let i = 0; i < months; i++) {
    const interest = b * r
    totalInterest += interest
    b = b + interest - payment
    if (b <= 0) break
  }
  return { months, totalInterest }
}

// ----- Small presentational helpers -----------------------------------------
function Stat({
  label,
  value,
  valueClass,
}: {
  label: string
  value: React.ReactNode
  valueClass?: string
}) {
  return (
    <div className="space-y-0.5 min-w-0">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
        {label}
      </p>
      <p className={cn('text-base font-bold tabular-nums truncate', valueClass)}>{value}</p>
    </div>
  )
}

// ----- Thermometer -----------------------------------------------------------
// A "filled" progress bar that reveals a rose→amber→emerald gradient as the
// debt is paid down. At 100% it is fully emerald (paid off).
function Thermometer({ progress, paidOff }: { progress: number; paidOff: boolean }) {
  const pct = clampPercent(progress)
  // Stretch the gradient across the FULL track so that low progress shows rose,
  // mid progress shows rose→amber, and full shows rose→amber→emerald.
  const bgSize = `${Math.max(100, 10000 / Math.max(pct, 1))}% 100%`
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">% paid off</span>
        <span className={cn('font-semibold tabular-nums', paidOff ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div
        className={cn(
          'relative h-3.5 w-full overflow-hidden rounded-full',
          paidOff ? 'bg-emerald-500/15' : 'bg-rose-500/10',
        )}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            backgroundImage: paidOff
              ? 'linear-gradient(90deg, #10b981, #14b8a6)'
              : 'linear-gradient(90deg, #f43f5e 0%, #f59e0b 55%, #10b981 100%)',
            backgroundSize: paidOff ? '100% 100%' : bgSize,
            backgroundPosition: 'left center',
            backgroundRepeat: 'no-repeat',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ----- Add/Edit Debt form ----------------------------------------------------
function DebtForm({
  initial,
  onSubmit,
  onCancel,
  pending,
}: {
  initial?: LoadedDebt
  onSubmit: (data: Record<string, unknown>) => void
  onCancel: () => void
  pending: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [creditor, setCreditor] = useState(initial?.creditor ?? '')
  const [currentBalance, setCurrentBalance] = useState(
    initial?.currentBalance?.toString() ?? '',
  )
  const [originalBalance, setOriginalBalance] = useState(
    initial?.originalBalance?.toString() ?? '',
  )
  const [interestRate, setInterestRate] = useState(
    initial?.interestRate?.toString() ?? '',
  )
  const [minimumPayment, setMinimumPayment] = useState(
    initial?.minimumPayment?.toString() ?? '',
  )
  const [strategyVal, setStrategyVal] = useState<DebtStrategy>(
    initial?.strategy ?? 'SNOWBALL',
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    const cb = parseFloat(currentBalance) || 0
    const ob = parseFloat(originalBalance) || cb
    onSubmit({
      name: name.trim(),
      creditor: creditor.trim() || null,
      currentBalance: cb,
      originalBalance: ob,
      interestRate: parseFloat(interestRate) || 0,
      minimumPayment: parseFloat(minimumPayment) || 0,
      strategy: strategyVal,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="debt-name">Debt Name</Label>
          <Input
            id="debt-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Visa Platinum"
            autoFocus
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="debt-creditor">Creditor (optional)</Label>
          <Input
            id="debt-creditor"
            value={creditor}
            onChange={(e) => setCreditor(e.target.value)}
            placeholder="e.g. Chase Bank"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="debt-current">Current Balance</Label>
          <Input
            id="debt-current"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={currentBalance}
            onChange={(e) => setCurrentBalance(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="debt-original">Original Balance</Label>
          <Input
            id="debt-original"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={originalBalance}
            onChange={(e) => setOriginalBalance(e.target.value)}
            placeholder="Defaults to current balance"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="debt-rate">Interest Rate (%)</Label>
          <Input
            id="debt-rate"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            placeholder="e.g. 22.9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="debt-min">Minimum Payment</Label>
          <Input
            id="debt-min"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={minimumPayment}
            onChange={(e) => setMinimumPayment(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Strategy</Label>
          <Select value={strategyVal} onValueChange={(v) => setStrategyVal(v as DebtStrategy)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pick a strategy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SNOWBALL">Snowball — smallest balance first</SelectItem>
              <SelectItem value="AVALANCHE">Avalanche — highest interest first</SelectItem>
              <SelectItem value="CUSTOM">Custom — manual order</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The tab-level toggle above controls display order. This is the per-debt default.
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : initial ? 'Save Changes' : 'Add Debt'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ----- Record Payment form ---------------------------------------------------
function PaymentForm({
  debt,
  onSubmit,
  onCancel,
  pending,
}: {
  debt: LoadedDebt
  onSubmit: (data: { amount: number; date?: string; note?: string }) => void
  onCancel: () => void
  pending: boolean
}) {
  const [amount, setAmount] = useState(
    debt.minimumPayment > 0 ? debt.minimumPayment.toString() : '',
  )
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }
    if (amt > debt.currentBalance) {
      toast.warning('Payment exceeds current balance — recording a payoff!')
    }
    onSubmit({
      amount: amt,
      date: date ? new Date(date).toISOString() : undefined,
      note: note.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-muted/50 p-3 text-sm flex items-center justify-between">
        <span className="text-muted-foreground">Paying down</span>
        <span className="font-semibold">{debt.name}</span>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pay-amount">Payment Amount</Label>
        <Input
          id="pay-amount"
          type="number"
          step="0.01"
          min="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Minimum payment: <Currency amount={debt.minimumPayment} /> · Current balance:{' '}
          <Currency amount={debt.currentBalance} />
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pay-date">Date</Label>
        <Input
          id="pay-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pay-note">Note (optional)</Label>
        <Textarea
          id="pay-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Monthly auto-pay, extra $50 snowball"
          rows={2}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Recording…' : 'Record Payment'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ----- Single Debt Card ------------------------------------------------------
function DebtCard({
  debt,
  onEdit,
  onDelete,
  onPay,
  index,
}: {
  debt: LoadedDebt
  onEdit: (d: LoadedDebt) => void
  onDelete: (d: LoadedDebt) => void
  onPay: (d: LoadedDebt) => void
  index: number
}) {
  const isPaid = debt.paidOff || debt.currentBalance <= 0
  const progress =
    debt.originalBalance > 0
      ? ((debt.originalBalance - debt.currentBalance) / debt.originalBalance) * 100
      : isPaid
        ? 100
        : 0
  const payoff = computePayoff(debt.currentBalance, debt.interestRate, debt.minimumPayment)
  const lastPayment = debt.payments?.[0]
  const paymentCount = debt.payments?.length ?? 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
    >
      <Card
        className={cn(
          'p-5 gap-4 h-full transition-colors',
          isPaid
            ? 'border-emerald-500/40 bg-emerald-500/[0.04]'
            : 'hover:border-rose-500/30',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                'rounded-lg p-2 shrink-0',
                isPaid ? 'bg-emerald-500/10' : 'bg-rose-500/10',
              )}
            >
              {isPaid ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <CreditCard className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold truncate">{debt.name}</h3>
                {isPaid && (
                  <Badge className="bg-emerald-500 text-white hover:bg-emerald-500 border-0">
                    🎉 Paid off!
                  </Badge>
                )}
              </div>
              {debt.creditor ? (
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Landmark className="h-3 w-3" />
                  {debt.creditor}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/70">No creditor</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(debt)}
              aria-label={`Edit ${debt.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
              onClick={() => onDelete(debt)}
              aria-label={`Delete ${debt.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Thermometer */}
        <div className="space-y-2">
          <Thermometer progress={progress} paidOff={isPaid} />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              <Currency amount={debt.originalBalance - debt.currentBalance} /> paid down
            </span>
            <span>
              <Currency amount={debt.currentBalance} /> remaining
            </span>
          </div>
        </div>

        <Separator />

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat
            label="Current"
            value={<Currency amount={debt.currentBalance} />}
            valueClass="text-rose-600 dark:text-rose-400 text-lg"
          />
          <Stat label="Original" value={<Currency amount={debt.originalBalance} />} />
          <Stat
            label="Interest"
            value={`${debt.interestRate.toFixed(debt.interestRate % 1 === 0 ? 0 : 1)}%`}
            valueClass="text-amber-600 dark:text-amber-400"
          />
          <Stat label="Min Payment" value={<Currency amount={debt.minimumPayment} />} />
        </div>

        {/* Payoff estimate */}
        <div
          className={cn(
            'rounded-lg p-3 text-xs',
            isPaid
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : payoff.months === null
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'bg-muted/60 text-muted-foreground',
          )}
        >
          {isPaid ? (
            <span className="font-medium flex items-center gap-1.5">
              <PartyPopper className="h-3.5 w-3.5" />
              Paid off — congratulations! 🎉
            </span>
          ) : payoff.months === null ? (
            <span className="font-medium flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" />
              Minimum payment too low to ever pay off. Increase your payment to make progress.
            </span>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Payoff in{' '}
                <span className="font-semibold text-foreground">
                  {payoff.months} {payoff.months === 1 ? 'month' : 'months'}
                </span>
              </span>
              {payoff.totalInterest !== null && payoff.totalInterest > 0 && (
                <span>
                  Total interest:{' '}
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    <Currency amount={payoff.totalInterest} />
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Payment history */}
        {lastPayment && (
          <p className="text-xs text-muted-foreground">
            Last payment:{' '}
            <span className="font-medium text-foreground">
              <Currency amount={lastPayment.amount} />
            </span>{' '}
            on {formatDate(lastPayment.date, 'medium')}
            {paymentCount > 1 && (
              <span className="text-muted-foreground/70"> · {paymentCount} payments recorded</span>
            )}
          </p>
        )}

        {/* Action */}
        {!isPaid && (
          <Button onClick={() => onPay(debt)} className="w-full sm:w-auto">
            <DollarSign className="h-4 w-4" />
            Record Payment
          </Button>
        )}
      </Card>
    </motion.div>
  )
}

// ----- Main component --------------------------------------------------------
export function DebtTab() {
  const { data: rawDebts, isLoading, isError, error } = useDebts()
  const createDebt = useCreateDebt()
  const updateDebt = useUpdateDebt()
  const deleteDebt = useDeleteDebt()
  const recordPayment = useDebtPayment()

  const [strategy, setStrategy] = useState<StrategyView>('SNOWBALL')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LoadedDebt | null>(null)
  const [payTarget, setPayTarget] = useState<LoadedDebt | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LoadedDebt | null>(null)

  const list = (rawDebts ?? []) as LoadedDebt[]

  const sorted = useMemo(() => {
    const arr = [...list]
    arr.sort((a, b) => {
      // Keep paid-off debts at the bottom of the list (still celebrated, but out of the way)
      if (a.paidOff !== b.paidOff) return a.paidOff ? 1 : -1
      if (strategy === 'SNOWBALL') {
        // Smallest current balance first
        return a.currentBalance - b.currentBalance
      }
      // Avalanche: highest interest rate first
      return b.interestRate - a.interestRate
    })
    return arr
  }, [list, strategy])

  const totals = useMemo(() => {
    let totalDebt = 0
    let totalPaidOff = 0
    let totalMin = 0
    let maxMonths = 0
    let anyNever = false

    for (const d of list) {
      totalDebt += d.currentBalance
      totalPaidOff += Math.max(0, d.originalBalance - d.currentBalance)
      totalMin += d.minimumPayment
      const { months } = computePayoff(d.currentBalance, d.interestRate, d.minimumPayment)
      if (months === null) anyNever = true
      else if (months > maxMonths) maxMonths = months
    }

    let debtFreeLabel: string
    if (list.length === 0) {
      debtFreeLabel = 'No debts'
    } else if (anyNever) {
      debtFreeLabel = 'Increase payments'
    } else if (maxMonths === 0) {
      debtFreeLabel = 'Already free! 🎉'
    } else {
      const d = new Date()
      d.setMonth(d.getMonth() + maxMonths)
      const mon = d.toLocaleDateString('en-US', { month: 'short' })
      debtFreeLabel = `${mon} ${d.getFullYear()}`
    }

    return { totalDebt, totalPaidOff, totalMin, anyNever, debtFreeLabel }
  }, [list])

  const handleCreate = async (data: Record<string, unknown>) => {
    try {
      await createDebt.mutateAsync(data)
      toast.success('Debt added — let&apos;s crush it! 🔥')
      setAddOpen(false)
    } catch (e) {
      toast.error((e as Error).message || 'Failed to add debt')
    }
  }

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!editTarget) return
    try {
      await updateDebt.mutateAsync({ id: editTarget.id, ...data })
      toast.success('Debt updated')
      setEditTarget(null)
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update debt')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    try {
      await deleteDebt.mutateAsync(target.id)
      toast.success(`Deleted "${target.name}"`)
      setDeleteTarget(null)
    } catch (e) {
      toast.error((e as Error).message || 'Failed to delete debt')
    }
  }

  const handlePayment = async (payload: { amount: number; date?: string; note?: string }) => {
    if (!payTarget) return
    const target = payTarget
    try {
      await recordPayment.mutateAsync({ id: target.id, ...payload })
      const willPayOff = payload.amount >= target.currentBalance
      toast.success(willPayOff ? '🎉 Payment recorded — debt paid off!' : 'Payment recorded!')
      setPayTarget(null)
    } catch (e) {
      toast.error((e as Error).message || 'Failed to record payment')
    }
  }

  // ----- Loading state -------------------------------------------------------
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-rose-600 dark:text-rose-400 mb-2">Failed to load debts.</p>
        <p className="text-xs text-muted-foreground">{(error as Error)?.message}</p>
      </Card>
    )
  }

  // ----- Header (shared by empty + populated states) -------------------------
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Flame className="h-6 w-6 text-rose-500" />
          Debt Payoff Tracker
        </h2>
        <p className="text-sm text-muted-foreground">
          Crush debt one payment at a time — watch the thermometer fill.
        </p>
      </div>
      <Button onClick={() => setAddOpen(true)}>
        <Plus className="h-4 w-4" />
        Add Debt
      </Button>
    </div>
  )

  // ----- Empty state ---------------------------------------------------------
  if (list.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="p-10 text-center border-emerald-500/30 bg-emerald-500/[0.03]">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <PartyPopper className="h-14 w-14 text-emerald-500 mx-auto mb-4" />
          </motion.div>
          <h3 className="text-xl font-bold mb-1">🎉 You have no debts tracked.</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
            You&apos;re debt-free! Add a debt to start tracking your payoff journey and
            visualize your progress.
          </p>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add a Debt
          </Button>
        </Card>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Debt</DialogTitle>
              <DialogDescription>
                Track a debt and watch your progress as you pay it down.
              </DialogDescription>
            </DialogHeader>
            <DebtForm
              key="new"
              onSubmit={handleCreate}
              onCancel={() => setAddOpen(false)}
              pending={createDebt.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ----- Populated state -----------------------------------------------------
  return (
    <div className="space-y-6">
      {header}

      {/* Strategy selector */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              {strategy === 'SNOWBALL' ? (
                <Snowflake className="h-5 w-5 text-rose-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-amber-500" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold">Payoff Strategy</h3>
              <p className="text-xs text-muted-foreground">
                {strategy === 'SNOWBALL'
                  ? 'Pay off smallest balances first — quick wins keep you motivated.'
                  : 'Pay off highest-interest debts first — saves the most money.'}
              </p>
            </div>
          </div>
          <div
            role="radiogroup"
            aria-label="Payoff strategy"
            className="inline-flex rounded-lg border bg-muted/50 p-1 self-start"
          >
            <button
              type="button"
              role="radio"
              aria-checked={strategy === 'SNOWBALL'}
              onClick={() => setStrategy('SNOWBALL')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                strategy === 'SNOWBALL'
                  ? 'bg-background shadow-sm text-rose-600 dark:text-rose-400'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Snowflake className="h-3.5 w-3.5" />
              Snowball
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={strategy === 'AVALANCHE'}
              onClick={() => setStrategy('AVALANCHE')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                strategy === 'AVALANCHE'
                  ? 'bg-background shadow-sm text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <TrendingDown className="h-3.5 w-3.5" />
              Avalanche
            </button>
          </div>
        </div>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Debt"
          value={<Currency amount={totals.totalDebt} compact />}
          icon={CreditCard}
          iconColor="text-rose-600"
          sublabel="What you still owe"
        />
        <StatCard
          label="Total Paid Off"
          value={<Currency amount={totals.totalPaidOff} compact />}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          sublabel="Crushed so far 🎉"
        />
        <StatCard
          label="Monthly Minimum"
          value={<Currency amount={totals.totalMin} compact />}
          icon={CalendarClock}
          iconColor="text-amber-600"
          sublabel="Sum of minimums"
        />
        <StatCard
          label="Debt-Free By"
          value={
            <span
              className={cn(
                totals.anyNever
                  ? 'text-amber-600 dark:text-amber-400 text-base'
                  : 'text-emerald-600 dark:text-emerald-400',
              )}
            >
              {totals.debtFreeLabel}
            </span>
          }
          icon={PartyPopper}
          iconColor="text-emerald-600"
          sublabel={totals.anyNever ? 'At current minimums' : 'At minimum payments'}
        />
      </div>

      {/* Debt cards */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {sorted.map((d, i) => (
          <DebtCard
            key={d.id}
            debt={d}
            index={i}
            onEdit={(debt) => setEditTarget(debt)}
            onDelete={(debt) => setDeleteTarget(debt)}
            onPay={(debt) => setPayTarget(debt)}
          />
        ))}
      </div>

      {/* Add Debt Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Debt</DialogTitle>
            <DialogDescription>
              Track a debt and watch your progress as you pay it down.
            </DialogDescription>
          </DialogHeader>
          <DebtForm
            key="new"
            onSubmit={handleCreate}
            onCancel={() => setAddOpen(false)}
            pending={createDebt.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Debt Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Debt</DialogTitle>
            <DialogDescription>Update the details for this debt.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <DebtForm
              key={editTarget.id}
              initial={editTarget}
              onSubmit={handleUpdate}
              onCancel={() => setEditTarget(null)}
              pending={updateDebt.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={!!payTarget} onOpenChange={(v) => !v && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Every payment fills the thermometer. You&apos;ve got this!
            </DialogDescription>
          </DialogHeader>
          {payTarget && (
            <PaymentForm
              key={payTarget.id}
              debt={payTarget}
              onSubmit={handlePayment}
              onCancel={() => setPayTarget(null)}
              pending={recordPayment.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete debt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong>{' '}
              and all of its payment history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
