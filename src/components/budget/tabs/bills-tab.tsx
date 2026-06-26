'use client'

import { useMemo, useState } from 'react'
import {
  CalendarClock, Plus, Pencil, Trash2, MoreVertical, CheckCircle2, Repeat,
  AlertTriangle, CreditCard, Ban, Zap,
} from 'lucide-react'
import {
  useBills, useCreateBill, useUpdateBill, useDeleteBill,
} from '@/lib/api-hooks'
import { formatDate } from '@/lib/format'
import { Currency } from '@/components/budget/currency'
import { StatCard } from '@/components/budget/stat-card'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Bill, BillFrequency } from '@/lib/types'

// ---------- Date / cost helpers ----------

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function makeDateWithDay(year: number, month: number, day: number): Date {
  const dim = daysInMonth(year, month)
  const d = new Date(year, month, Math.min(Math.max(1, day), dim))
  d.setHours(0, 0, 0, 0)
  return d
}

const FREQUENCY_INTERVAL: Record<BillFrequency, number> = {
  WEEKLY: 0,
  MONTHLY: 1,
  QUARTERLY: 3,
  BIANNUAL: 6,
  ANNUAL: 12,
}

const FREQUENCY_LABEL: Record<BillFrequency, string> = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  BIANNUAL: 'Bi-annual',
  ANNUAL: 'Annual',
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function computeNextDue(bill: Bill, from: Date = new Date()): { date: Date; dueInDays: number } {
  const today = new Date(from)
  today.setHours(0, 0, 0, 0)

  if (bill.frequency === 'WEEKLY') {
    const target = bill.dueDay % 7
    const todayDay = today.getDay()
    let diff = (target - todayDay + 7) % 7
    if (diff === 0) diff = 7
    const date = new Date(today)
    date.setDate(date.getDate() + diff)
    return { date, dueInDays: diff }
  }

  const interval = FREQUENCY_INTERVAL[bill.frequency]
  const anchor = bill.lastPaidDate ? new Date(bill.lastPaidDate) : new Date(today)
  anchor.setHours(0, 0, 0, 0)

  let year = anchor.getFullYear()
  let month = anchor.getMonth()
  let candidate = makeDateWithDay(year, month, bill.dueDay)

  let attempts = 0
  while (candidate.getTime() < today.getTime() && attempts < 36) {
    month += interval
    while (month > 11) {
      month -= 12
      year += 1
    }
    candidate = makeDateWithDay(year, month, bill.dueDay)
    attempts += 1
  }

  const diff = Math.round((candidate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return { date: candidate, dueInDays: diff }
}

function monthlyEquivalent(bill: Bill): number {
  switch (bill.frequency) {
    case 'WEEKLY': return bill.amount * 4.345
    case 'MONTHLY': return bill.amount
    case 'QUARTERLY': return bill.amount / 3
    case 'BIANNUAL': return bill.amount / 6
    case 'ANNUAL': return bill.amount / 12
  }
}

function yearlyEquivalent(bill: Bill): number {
  switch (bill.frequency) {
    case 'WEEKLY': return bill.amount * 52
    case 'MONTHLY': return bill.amount * 12
    case 'QUARTERLY': return bill.amount * 4
    case 'BIANNUAL': return bill.amount * 2
    case 'ANNUAL': return bill.amount
  }
}

function isRecentlyPaid(bill: Bill): boolean {
  if (!bill.lastPaidDate) return false
  const last = new Date(bill.lastPaidDate)
  last.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
  return diff >= 0 && diff <= 7
}

function isAnnualLike(freq: BillFrequency): boolean {
  return freq === 'ANNUAL' || freq === 'BIANNUAL'
}

type EnrichedBill = Bill & { dueDate: Date; dueInDays: number }

// ---------- Badges ----------

function FrequencyBadge({ frequency }: { frequency: BillFrequency }) {
  if (frequency === 'WEEKLY') {
    return (
      <Badge className="bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30">
        {FREQUENCY_LABEL[frequency]}
      </Badge>
    )
  }
  if (isAnnualLike(frequency)) {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
        {FREQUENCY_LABEL[frequency]}
      </Badge>
    )
  }
  return <Badge variant="secondary">{FREQUENCY_LABEL[frequency]}</Badge>
}

function DueBadge({ dueInDays }: { dueInDays: number }) {
  if (dueInDays <= 0) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />Due today
      </Badge>
    )
  }
  if (dueInDays <= 3) {
    return (
      <Badge variant="destructive" className="gap-1">
        <CalendarClock className="h-3 w-3" />Due in {dueInDays}d
      </Badge>
    )
  }
  if (dueInDays <= 7) {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1">
        <CalendarClock className="h-3 w-3" />Due in {dueInDays}d
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <CalendarClock className="h-3 w-3" />Due in {dueInDays}d
    </Badge>
  )
}

// ---------- Bill row ----------

function BillRow({ bill }: { bill: EnrichedBill }) {
  const updateBill = useUpdateBill()
  const deleteBill = useDeleteBill()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const recentlyPaid = isRecentlyPaid(bill)
  const annualLike = isAnnualLike(bill.frequency)
  const pending = updateBill.isPending || deleteBill.isPending

  const handleCancelToggle = (checked: boolean) => {
    updateBill.mutate(
      { id: bill.id, cancelFlag: checked },
      {
        onSuccess: () => toast.success(checked ? 'Flagged to cancel' : 'Cancel flag removed'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const handleMarkPaid = () => {
    updateBill.mutate(
      { id: bill.id, lastPaidDate: new Date().toISOString() },
      {
        onSuccess: () => toast.success('Marked as paid!'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const handleActiveToggle = () => {
    const next = !bill.active
    updateBill.mutate(
      { id: bill.id, active: next },
      {
        onSuccess: () => toast.success(next ? 'Bill activated' : 'Bill deactivated'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const handleDelete = () => {
    deleteBill.mutate(bill.id, {
      onSuccess: () => {
        toast.success('Bill deleted')
        setDeleteOpen(false)
      },
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <Card
      className={cn(
        'p-4 transition-all',
        bill.cancelFlag && 'border-rose-500/40 bg-rose-500/5',
        !bill.active && 'opacity-60',
      )}
    >
      {/* Top row: name + amount */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm truncate">{bill.name}</h4>
            <FrequencyBadge frequency={bill.frequency} />
            {annualLike && (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1">
                <AlertTriangle className="h-3 w-3" />Annual bill
              </Badge>
            )}
            {bill.cancelFlag && (
              <Badge variant="destructive" className="gap-1">
                <Ban className="h-3 w-3" />Cancel?
              </Badge>
            )}
            {recentlyPaid && (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1">
                <CheckCircle2 className="h-3 w-3" />Paid
              </Badge>
            )}
          </div>
          {bill.category && (
            <p className="text-xs text-muted-foreground mt-1">{bill.category}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <Currency amount={bill.amount} className="font-semibold break-all" />
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            ≈ <Currency amount={monthlyEquivalent(bill)} compact /> /mo
          </p>
        </div>
      </div>

      <Separator className="my-3" />

      {/* Bottom: due info + controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {!recentlyPaid && <DueBadge dueInDays={bill.dueInDays} />}
          <span className="text-xs text-muted-foreground truncate">
            {bill.frequency === 'WEEKLY'
              ? `Every ${WEEKDAY_NAMES[bill.dueDay % 7]}`
              : formatDate(bill.dueDate, 'medium')}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none py-1.5">
            <Switch
              checked={bill.cancelFlag}
              onCheckedChange={handleCancelToggle}
              disabled={updateBill.isPending}
              aria-label={`Flag ${bill.name} for cancellation`}
            />
            <span>Cancel?</span>
          </label>
          {recentlyPaid ? (
            <Badge
              className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1"
            >
              <CheckCircle2 className="h-3 w-3" />Paid recently
            </Badge>
          ) : (
            <Button
              size="sm"
              onClick={handleMarkPaid}
              disabled={pending}
              className="h-9"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark Paid
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Bill actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleActiveToggle}>
                <Zap className="h-3.5 w-3.5" /> {bill.active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <BillDialog open={editOpen} onOpenChange={setEditOpen} bill={bill} />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{bill.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the bill from your tracker. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// ---------- Add/Edit form & dialog ----------

const DEFAULT_FORM = {
  name: '',
  amount: '',
  frequency: 'MONTHLY' as BillFrequency,
  dueDay: '1',
  category: '',
  isSubscription: false,
  active: true,
  cancelFlag: false,
}

function BillForm({
  bill,
  onDone,
  onCancel,
}: {
  bill?: Bill | null
  onDone: () => void
  onCancel: () => void
}) {
  const createBill = useCreateBill()
  const updateBill = useUpdateBill()
  const isEdit = !!bill

  const [name, setName] = useState(bill?.name ?? DEFAULT_FORM.name)
  const [amount, setAmount] = useState(
    bill?.amount != null ? String(bill.amount) : DEFAULT_FORM.amount,
  )
  const [frequency, setFrequency] = useState<BillFrequency>(
    bill?.frequency ?? DEFAULT_FORM.frequency,
  )
  const [dueDay, setDueDay] = useState(
    bill?.dueDay != null ? String(bill.dueDay) : DEFAULT_FORM.dueDay,
  )
  const [category, setCategory] = useState(bill?.category ?? DEFAULT_FORM.category)
  const [isSubscription, setIsSubscription] = useState(
    bill?.isSubscription ?? DEFAULT_FORM.isSubscription,
  )
  const [active, setActive] = useState(bill?.active ?? DEFAULT_FORM.active)
  const [cancelFlag, setCancelFlag] = useState(
    bill?.cancelFlag ?? DEFAULT_FORM.cancelFlag,
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = parseFloat(amount)
    const dayNum = parseInt(dueDay, 10)

    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error('Enter a valid amount greater than 0')
      return
    }
    if (Number.isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      toast.error('Due day must be between 1 and 31')
      return
    }

    const payload = {
      name: name.trim(),
      amount: amountNum,
      frequency,
      dueDay: dayNum,
      category: category.trim() || null,
      isSubscription,
      active,
      cancelFlag,
    }

    if (isEdit && bill) {
      updateBill.mutate(
        { id: bill.id, ...payload },
        {
          onSuccess: () => {
            toast.success('Bill updated')
            onDone()
          },
          onError: (e) => toast.error(e.message),
        },
      )
    } else {
      createBill.mutate(payload, {
        onSuccess: () => {
          toast.success('Bill added')
          onDone()
        },
        onError: (e) => toast.error(e.message),
      })
    }
  }

  const pending = createBill.isPending || updateBill.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bill-name">Name</Label>
        <Input
          id="bill-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Netflix, Rent, Car Insurance"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="bill-amount">Amount</Label>
          <Input
            id="bill-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bill-freq">Frequency</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as BillFrequency)}>
            <SelectTrigger id="bill-freq" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="QUARTERLY">Quarterly</SelectItem>
              <SelectItem value="BIANNUAL">Bi-annual</SelectItem>
              <SelectItem value="ANNUAL">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="bill-day">Due Day</Label>
          <Input
            id="bill-day"
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {frequency === 'WEEKLY'
              ? 'Weekday: 0=Sun, 6=Sat'
              : 'Day of month (1-31)'}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bill-cat">Category</Label>
          <Input
            id="bill-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Entertainment"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="bill-sub" className="cursor-pointer">Subscription</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recurring digital or streaming service
            </p>
          </div>
          <Switch
            id="bill-sub"
            checked={isSubscription}
            onCheckedChange={setIsSubscription}
            aria-label="Is subscription"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="bill-active" className="cursor-pointer">Active</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Include in summaries &amp; alerts
            </p>
          </div>
          <Switch
            id="bill-active"
            checked={active}
            onCheckedChange={setActive}
            aria-label="Active"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="bill-cancel" className="cursor-pointer">Flag for cancellation</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mark as &quot;waste&quot; to track
            </p>
          </div>
          <Switch
            id="bill-cancel"
            checked={cancelFlag}
            onCheckedChange={setCancelFlag}
            aria-label="Flag for cancellation"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add bill'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function BillDialog({
  open,
  onOpenChange,
  bill,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  bill?: Bill | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bill ? 'Edit bill' : 'Add bill'}</DialogTitle>
          <DialogDescription>
            {bill
              ? 'Update the details of this bill or subscription.'
              : 'Track a recurring bill or subscription to never miss a payment.'}
          </DialogDescription>
        </DialogHeader>
        <BillForm
          key={bill?.id ?? 'new'}
          bill={bill}
          onDone={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

// ---------- Section empty state ----------

function EmptySection({
  title,
  description,
  onAdd,
}: {
  title: string
  description: string
  onAdd: () => void
}) {
  return (
    <Card className="p-10 flex flex-col items-center justify-center text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <CreditCard className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      <Button variant="outline" className="mt-4" onClick={onAdd}>
        <Plus className="h-4 w-4" /> Add bill
      </Button>
    </Card>
  )
}

// ---------- Main tab ----------

export function BillsTab() {
  const { data: bills, isLoading, isError, error } = useBills()
  const [addOpen, setAddOpen] = useState(false)
  const [tab, setTab] = useState('subscriptions')

  const enriched = useMemo<EnrichedBill[]>(() => {
    if (!bills) return []
    return bills.map((b) => {
      const due = computeNextDue(b)
      return { ...b, dueDate: due.date, dueInDays: due.dueInDays }
    })
  }, [bills])

  const subscriptions = useMemo(
    () =>
      enriched
        .filter((b) => b.isSubscription)
        .sort((a, b) => a.dueInDays - b.dueInDays),
    [enriched],
  )

  const regularBills = useMemo(
    () =>
      enriched
        .filter((b) => !b.isSubscription)
        .sort((a, b) => a.dueInDays - b.dueInDays),
    [enriched],
  )

  const stats = useMemo(() => {
    const active = enriched.filter((b) => b.active)
    const subs = active.filter((b) => b.isSubscription)
    const waste = active.filter((b) => b.cancelFlag)
    const annualLike = active.filter((b) => isAnnualLike(b.frequency))

    const subMonthly = subs.reduce((s, b) => s + monthlyEquivalent(b), 0)
    const subYearly = subs.reduce((s, b) => s + yearlyEquivalent(b), 0)
    const wasteMonthly = waste.reduce((s, b) => s + monthlyEquivalent(b), 0)
    const totalMonthly = active.reduce((s, b) => s + monthlyEquivalent(b), 0)
    const annualYearly = annualLike.reduce((s, b) => s + yearlyEquivalent(b), 0)

    return {
      subMonthly,
      subYearly,
      wasteMonthly,
      totalMonthly,
      annualCount: annualLike.length,
      annualYearly,
      annualMonthly: annualYearly / 12,
    }
  }, [enriched])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-rose-500 mb-3" />
        <p className="text-sm font-medium">Failed to load bills</p>
        <p className="text-xs text-muted-foreground mt-1">
          {(error as Error)?.message ?? 'Please try again later.'}
        </p>
      </div>
    )
  }

  // Empty state — no bills at all
  if (!bills || bills.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Bills &amp; Subscriptions</h2>
              <p className="text-sm text-muted-foreground">
                Start tracking your recurring bills
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Bill
            </Button>
          </div>
        </div>

        <Card className="p-10 flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-primary/10 p-4 mb-4">
            <CalendarClock className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">No bills tracked yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Add your recurring bills and subscriptions to see due dates, monthly costs,
            and never miss a payment.
          </p>
          <Button className="mt-4" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add your first bill
          </Button>
        </Card>

        <BillDialog open={addOpen} onOpenChange={setAddOpen} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Bills &amp; Subscriptions</h2>
            <p className="text-sm text-muted-foreground">
              {bills.length} bill{bills.length === 1 ? '' : 's'} tracked ·{' '}
              {subscriptions.length} subscription{subscriptions.length === 1 ? '' : 's'} ·{' '}
              {regularBills.length} regular
            </p>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Bill
          </Button>
        </div>
      </div>

      {/* Annual / Bi-annual callout */}
      {stats.annualCount > 0 && (
        <Card className="p-4 border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-500/15 p-2 shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                You have {stats.annualCount} annual/bi-annual bill
                {stats.annualCount === 1 ? '' : 's'} totaling{' '}
                <Currency amount={stats.annualYearly} className="font-semibold" />/year.
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Set aside{' '}
                <Currency
                  amount={stats.annualMonthly}
                  className="font-semibold text-amber-700 dark:text-amber-300"
                />/month to avoid surprises.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Summary stat cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly Subscriptions"
          value={<Currency amount={stats.subMonthly} />}
          icon={Repeat}
          iconColor="text-teal-600 dark:text-teal-400"
          sublabel="Recurring services"
        />
        <StatCard
          label="Yearly Subscriptions"
          value={<Currency amount={stats.subYearly} compact />}
          icon={CalendarClock}
          iconColor="text-primary"
          sublabel="Annual cost"
        />
        <StatCard
          label="Monthly Waste"
          value={<Currency amount={stats.wasteMonthly} />}
          icon={Ban}
          iconColor="text-rose-600 dark:text-rose-400"
          sublabel="Flagged to cancel"
        />
        <StatCard
          label="Total Monthly Bills"
          value={<Currency amount={stats.totalMonthly} />}
          icon={CreditCard}
          iconColor="text-amber-600 dark:text-amber-400"
          sublabel="All active bills"
        />
      </div>

      {/* Bills list — grouped by subscriptions vs regular */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="subscriptions" className="gap-1.5">
            <Repeat className="h-3.5 w-3.5" />
            <span className="truncate">Subscriptions</span>
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
              {subscriptions.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="regular" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            <span className="truncate">Regular Bills</span>
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
              {regularBills.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="mt-4">
          {subscriptions.length === 0 ? (
            <EmptySection
              title="No subscriptions yet"
              description="Track streaming, software, or other recurring digital subscriptions here."
              onAdd={() => setAddOpen(true)}
            />
          ) : (
            <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
              {subscriptions.map((b) => (
                <BillRow key={b.id} bill={b} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="regular" className="mt-4">
          {regularBills.length === 0 ? (
            <EmptySection
              title="No regular bills yet"
              description="Track rent, utilities, insurance, and other fixed bills here."
              onAdd={() => setAddOpen(true)}
            />
          ) : (
            <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
              {regularBills.map((b) => (
                <BillRow key={b.id} bill={b} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BillDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
