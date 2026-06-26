'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  Plus,
  Pencil,
  Trash2,
  PiggyBank,
  Trophy,
  CalendarClock,
  CheckCircle2,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import {
  useSavingsGoals,
  useCreateSavingsGoal,
  useUpdateSavingsGoal,
  useDeleteSavingsGoal,
  useSettings,
} from '@/lib/api-hooks'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Currency } from '@/components/budget/currency'
import { ProgressBar } from '@/components/budget/progress-bar'
import {
  colorHex,
  COLOR_KEYS,
  CATEGORY_ICONS,
  daysUntil,
  formatDate,
  clampPercent,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { SavingsGoal } from '@/lib/types'

// ---- Popular goal presets (clickable chips that prefill the dialog) ----
const POPULAR_GOALS: {
  name: string
  icon: string
  color: string
  targetAmount: number
}[] = [
  { name: 'Emergency Fund', icon: '🛟', color: 'emerald', targetAmount: 10000 },
  { name: 'Vacation', icon: '🏖️', color: 'cyan', targetAmount: 3000 },
  { name: 'New Car', icon: '🚙', color: 'slate', targetAmount: 25000 },
  { name: 'Christmas Gifts', icon: '🎄', color: 'rose', targetAmount: 800 },
  { name: 'Home Down Payment', icon: '🏠', color: 'teal', targetAmount: 50000 },
  { name: 'Wedding', icon: '💍', color: 'pink', targetAmount: 15000 },
]

const EMERALD_HEX = colorHex('emerald')

// ---- Helpers ----
function progressPct(goal: SavingsGoal): number {
  if (goal.targetAmount <= 0) return goal.savedAmount > 0 ? 100 : 0
  return clampPercent((goal.savedAmount / goal.targetAmount) * 100)
}

function isGoalComplete(goal: SavingsGoal): boolean {
  return goal.targetAmount > 0 && goal.savedAmount >= goal.targetAmount
}

// =====================================================
// Hero summary card
// =====================================================
function HeroSummary({ goals }: { goals: SavingsGoal[] }) {
  const totalSaved = goals.reduce((s, g) => s + g.savedAmount, 0)
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
  const overallPct = totalTarget > 0 ? clampPercent((totalSaved / totalTarget) * 100) : 0
  const completed = goals.filter(isGoalComplete).length

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-500/15 via-teal-500/8 to-transparent p-6 sm:p-7">
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            <PiggyBank className="h-3.5 w-3.5 shrink-0" />
            Savings &amp; Sinking Funds
          </div>
          <motion.h2
            key={Math.round(totalSaved)}
            initial={{ opacity: 0.6, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl break-all leading-tight"
          >
            <Currency amount={totalSaved} />
          </motion.h2>
          <p className="text-sm text-muted-foreground break-words">
            of <span className="font-medium text-foreground"><Currency amount={totalTarget} /></span>{' '}
            saved across{' '}
            <span className="font-medium text-foreground">{goals.length}</span>{' '}
            {goals.length === 1 ? 'goal' : 'goals'}
            {completed > 0 && (
              <>
                {' '}·{' '}
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {completed} reached 🎉
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-2">
          <div className="rounded-xl border bg-background/70 px-4 py-2.5 text-right backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Overall Progress
            </p>
            <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {overallPct.toFixed(0)}%
            </p>
          </div>
          {completed > 0 && (
            <Badge
              variant="secondary"
              className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
            >
              <Trophy className="h-3 w-3" /> {completed} {completed === 1 ? 'goal' : 'goals'} complete
            </Badge>
          )}
        </div>
      </div>

      <div className="relative mt-5">
        <ProgressBar value={overallPct} height="h-3" color={EMERALD_HEX} />
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Saved
          </span>
          <span>
            <Currency amount={Math.max(0, totalTarget - totalSaved)} compact /> to go
          </span>
        </div>
      </div>
    </div>
  )
}

// =====================================================
// Single goal card
// =====================================================
interface GoalCardProps {
  goal: SavingsGoal
  index: number
  onAddFunds: (goal: SavingsGoal) => void
  onEdit: (goal: SavingsGoal) => void
  onDelete: (goal: SavingsGoal) => void
}

function GoalCard({ goal, index, onAddFunds, onEdit, onDelete }: GoalCardProps) {
  const pct = progressPct(goal)
  const hex = colorHex(goal.color)
  const reached = isGoalComplete(goal)
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount)

  // Target date info
  let dateLabel: React.ReactNode = null
  let dateTone = 'text-muted-foreground'
  if (goal.targetDate) {
    const days = daysUntil(goal.targetDate)
    if (days < 0) {
      dateLabel = (
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3 w-3" /> Past due · {formatDate(goal.targetDate, 'short')}
        </span>
      )
      dateTone = 'text-rose-600 dark:text-rose-400 font-medium'
    } else if (days === 0) {
      dateLabel = (
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3 w-3" /> Due today · {formatDate(goal.targetDate, 'short')}
        </span>
      )
      dateTone = 'text-amber-600 dark:text-amber-400 font-medium'
    } else {
      dateLabel = (
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3 w-3" /> {formatDate(goal.targetDate, 'medium')} · {days}{' '}
          {days === 1 ? 'day' : 'days'} left
        </span>
      )
      dateTone =
        days <= 14
          ? 'text-amber-600 dark:text-amber-400 font-medium'
          : 'text-muted-foreground'
    }
  } else {
    dateLabel = (
      <span className="inline-flex items-center gap-1">
        <CalendarClock className="h-3 w-3" /> No deadline
      </span>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.05, 0.3), ease: 'easeOut' }}
    >
      <Card
        className={cn(
          'relative overflow-hidden p-5 pl-6 transition-shadow hover:shadow-md',
          reached && 'border-emerald-500/40 bg-emerald-500/[0.03]',
        )}
      >
        {/* accent stripe */}
        <div
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ backgroundColor: hex }}
          aria-hidden
        />

        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl"
            style={{ backgroundColor: `${hex}1f` }}
            aria-hidden
          >
            <span>{goal.icon || '🎯'}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold leading-tight">{goal.name}</h3>
                <p className={cn('mt-0.5 text-xs', dateTone)}>{dateLabel}</p>
              </div>
              {reached && (
                <Badge
                  variant="secondary"
                  className="shrink-0 gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Trophy className="h-3 w-3" /> Reached!
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* progress */}
        <div className="mt-4">
          <ProgressBar value={pct} height="h-3" color={hex} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
            <span className="font-medium tabular-nums min-w-0">
              <Currency amount={goal.savedAmount} />
              <span className="text-muted-foreground">
                {' '}/ <Currency amount={goal.targetAmount} />
              </span>
            </span>
            <span className="font-semibold tabular-nums shrink-0" style={{ color: hex }}>
              {pct.toFixed(0)}%
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {reached ? (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Goal complete — congrats!
              </span>
            ) : (
              <>
                <Currency amount={remaining} /> to go
                {goal.targetDate && daysUntil(goal.targetDate) > 0 && (
                  <span className="text-muted-foreground/70">
                    {' '}· about{' '}
                    <Currency amount={remaining / Math.max(1, daysUntil(goal.targetDate))} compact />/day
                  </span>
                )}
              </>
            )}
          </p>
        </div>

        <Separator className="my-4" />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            size="sm"
            onClick={() => onAddFunds(goal)}
            className="w-full sm:w-auto gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> Add Funds
          </Button>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-10 w-10 p-0"
              onClick={() => onEdit(goal)}
              aria-label={`Edit ${goal.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-10 w-10 p-0 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
              onClick={() => onDelete(goal)}
              aria-label={`Delete ${goal.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

// =====================================================
// Add Funds Dialog
// =====================================================
interface AddFundsDialogProps {
  goal: SavingsGoal
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AddFundsDialog({ goal, open, onOpenChange }: AddFundsDialogProps) {
  const updateGoal = useUpdateSavingsGoal()
  const { data: settings } = useSettings()
  const sym = settings?.currencySymbol ?? '$'
  const [amount, setAmount] = useState('')

  const quickAmounts = [25, 50, 100, 250]
  const parsed = parseFloat(amount)
  const validAmount = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  const projectedSaved = goal.savedAmount + validAmount
  const willComplete =
    validAmount > 0 &&
    goal.targetAmount > 0 &&
    projectedSaved >= goal.targetAmount &&
    goal.savedAmount < goal.targetAmount

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (validAmount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    updateGoal.mutate(
      { id: goal.id, addAmount: validAmount },
      {
        onSuccess: () => {
          toast.success(
            `Added ${sym}${validAmount.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} to ${goal.name}!${willComplete ? ' 🎉 Goal reached!' : ''}`,
          )
          onOpenChange(false)
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              {goal.icon}
            </span>
            Add Funds to {goal.name}
          </DialogTitle>
          <DialogDescription>
            Add a contribution to this goal. Current balance:{' '}
            <span className="font-medium text-foreground">
              <Currency amount={goal.savedAmount} />
            </span>{' '}
            of <Currency amount={goal.targetAmount} />.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-amount">Amount</Label>
            <Input
              id="add-amount"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className="rounded-full border bg-muted/40 px-3 py-2 text-xs font-medium tabular-nums transition-colors hover:bg-muted"
                >
                  +<Currency amount={q} compact />
                </button>
              ))}
            </div>
          </div>

          {/* projection preview */}
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">New balance</span>
              <span className="font-semibold tabular-nums">
                <Currency amount={projectedSaved} />
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar
                value={clampPercent((projectedSaved / Math.max(1, goal.targetAmount)) * 100)}
                height="h-2"
                color={colorHex(goal.color)}
              />
            </div>
            {willComplete && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Trophy className="h-3.5 w-3.5" /> This contribution completes the goal!
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={updateGoal.isPending || validAmount <= 0}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              {updateGoal.isPending ? (
                'Adding…'
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Add Funds
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// Goal Form Dialog (create / edit)
// =====================================================
interface GoalFormDialogProps {
  mode: 'create' | 'edit'
  goal: SavingsGoal | null
  preset: { name?: string; icon?: string; color?: string; targetAmount?: number } | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function GoalFormDialog({ mode, goal, preset, open, onOpenChange }: GoalFormDialogProps) {
  const createGoal = useCreateSavingsGoal()
  const updateGoal = useUpdateSavingsGoal()

  // Initialize from goal (edit) or preset (create) — keyed remount guarantees fresh state
  const [name, setName] = useState(goal?.name ?? preset?.name ?? '')
  const [targetAmount, setTargetAmount] = useState(
    String(goal?.targetAmount ?? preset?.targetAmount ?? ''),
  )
  const [savedAmount, setSavedAmount] = useState(String(goal?.savedAmount ?? 0))
  const [targetDate, setTargetDate] = useState(
    goal?.targetDate ? goal.targetDate.slice(0, 10) : '',
  )
  const [color, setColor] = useState(goal?.color ?? preset?.color ?? 'emerald')
  const [icon, setIcon] = useState(goal?.icon ?? preset?.icon ?? '🎯')

  const isPending = createGoal.isPending || updateGoal.isPending
  const hex = colorHex(color)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const nameTrim = name.trim()
    if (!nameTrim) {
      toast.error('Goal name is required')
      return
    }
    const target = parseFloat(targetAmount)
    if (!Number.isFinite(target) || target <= 0) {
      toast.error('Enter a target amount greater than 0')
      return
    }
    const saved = Math.max(0, parseFloat(savedAmount) || 0)
    if (saved > target) {
      toast.error('Saved amount cannot exceed target')
      return
    }
    const dateVal = targetDate ? new Date(targetDate + 'T12:00:00').toISOString() : null

    if (mode === 'create') {
      createGoal.mutate(
        {
          name: nameTrim,
          targetAmount: target,
          savedAmount: saved,
          targetDate: dateVal,
          color,
          icon,
        },
        {
          onSuccess: () => {
            toast.success(`Created "${nameTrim}" goal!`)
            onOpenChange(false)
          },
          onError: (err) => toast.error(err.message),
        },
      )
    } else if (goal) {
      updateGoal.mutate(
        {
          id: goal.id,
          name: nameTrim,
          targetAmount: target,
          savedAmount: saved,
          targetDate: dateVal,
          color,
          icon,
        },
        {
          onSuccess: () => {
            toast.success(`Updated "${nameTrim}"`)
            onOpenChange(false)
          },
          onError: (err) => toast.error(err.message),
        },
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            {mode === 'create' ? 'New Savings Goal' : `Edit ${goal?.name}`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Set a target and start saving toward it.'
              : 'Update your goal details below.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-name">Goal Name</Label>
            <Input
              id="goal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Emergency Fund"
              autoFocus
              maxLength={60}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-target">Target Amount</Label>
              <Input
                id="goal-target"
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-saved">
                Already Saved{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="goal-saved"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={savedAmount}
                onChange={(e) => setSavedAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-date">
              Target Date <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="goal-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_KEYS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-9 w-9 rounded-full transition-transform',
                    color === c
                      ? 'ring-2 ring-offset-2 ring-offset-background scale-110'
                      : 'hover:scale-110',
                  )}
                  style={{ backgroundColor: colorHex(c) }}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-40 overflow-y-auto scrollbar-thin rounded-md border p-2">
              {CATEGORY_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-md text-lg transition-colors',
                    icon === ic
                      ? 'bg-emerald-500/20 ring-1 ring-emerald-500/40'
                      : 'hover:bg-muted',
                  )}
                  aria-label={`Icon ${ic}`}
                  aria-pressed={icon === ic}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
                style={{ backgroundColor: `${hex}1f` }}
                aria-hidden
              >
                {icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name || 'Goal name'}</p>
                <p className="text-xs text-muted-foreground">
                  <Currency amount={parseFloat(savedAmount) || 0} compact /> of{' '}
                  <Currency amount={parseFloat(targetAmount) || 0} compact />
                </p>
              </div>
            </div>
            <div className="mt-2">
              <ProgressBar
                value={clampPercent(
                  ((parseFloat(savedAmount) || 0) /
                    Math.max(1, parseFloat(targetAmount) || 1)) *
                    100,
                )}
                height="h-2"
                color={hex}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={isPending}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              {isPending ? (
                'Saving…'
              ) : mode === 'create' ? (
                <>
                  <Plus className="h-4 w-4" /> Create Goal
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================
// Popular goals chips
// =====================================================
function PopularGoals({
  onPick,
}: {
  onPick: (preset: (typeof POPULAR_GOALS)[number]) => void
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Popular Goals</h3>
          <p className="text-xs text-muted-foreground">
            Tap a suggestion to start a new goal, pre-filled.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {POPULAR_GOALS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => onPick(p)}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-2 text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-sm"
            style={{ borderColor: `${colorHex(p.color)}55` }}
          >
            <span className="text-base" aria-hidden>
              {p.icon}
            </span>
            <span>{p.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              · <Currency amount={p.targetAmount} compact />
            </span>
          </button>
        ))}
      </div>
    </Card>
  )
}

// =====================================================
// Empty state
// =====================================================
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="border-dashed p-10 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
        <Target className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h3 className="text-lg font-semibold">No savings goals yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Set your first savings goal and watch your progress grow with every
        contribution. Small steps add up to big wins!
      </p>
      <Button
        onClick={onCreate}
        className="mt-5 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
      >
        <Plus className="h-4 w-4" /> Create your first savings goal
      </Button>
    </Card>
  )
}

// =====================================================
// Main SavingsTab
// =====================================================
export function SavingsTab() {
  const { data: goals, isLoading, isError, error } = useSavingsGoals()
  const deleteGoal = useDeleteSavingsGoal()

  // Add-funds dialog
  const [addFundsGoal, setAddFundsGoal] = useState<SavingsGoal | null>(null)
  const [addFundsOpen, setAddFundsOpen] = useState(false)
  const [addFundsVersion, setAddFundsVersion] = useState(0)

  // Goal form dialog (create / edit)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [formGoal, setFormGoal] = useState<SavingsGoal | null>(null)
  const [formPreset, setFormPreset] = useState<{
    name?: string
    icon?: string
    color?: string
    targetAmount?: number
  } | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formVersion, setFormVersion] = useState(0)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SavingsGoal | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const openCreate = (
    preset?: { name?: string; icon?: string; color?: string; targetAmount?: number },
  ) => {
    setFormMode('create')
    setFormGoal(null)
    setFormPreset(preset ?? null)
    setFormVersion((v) => v + 1)
    setFormOpen(true)
  }

  const openEdit = (goal: SavingsGoal) => {
    setFormMode('edit')
    setFormGoal(goal)
    setFormPreset(null)
    setFormVersion((v) => v + 1)
    setFormOpen(true)
  }

  const openAddFunds = (goal: SavingsGoal) => {
    setAddFundsGoal(goal)
    setAddFundsVersion((v) => v + 1)
    setAddFundsOpen(true)
  }

  const openDelete = (goal: SavingsGoal) => {
    setDeleteTarget(goal)
    setDeleteOpen(true)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const target = deleteTarget
    deleteGoal.mutate(target.id, {
      onSuccess: () => {
        toast.success(`Deleted "${target.name}"`)
        setDeleteOpen(false)
        setDeleteTarget(null)
      },
      onError: (err) => toast.error(err.message),
    })
  }

  const sortedGoals = useMemo(() => {
    if (!goals) return []
    return [...goals].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return b.savedAmount - a.savedAmount
    })
  }, [goals])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 rounded-2xl" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-rose-600 dark:text-rose-400">
          Failed to load savings goals: {error?.message}
        </p>
      </Card>
    )
  }

  const hasGoals = sortedGoals.length > 0

  return (
    <div className="space-y-6">
      {hasGoals && <HeroSummary goals={sortedGoals} />}

      {/* Header row with Add Goal button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">
            {hasGoals ? 'Your Goals' : 'Start Saving'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {hasGoals
              ? 'Track progress and add funds as you save.'
              : 'Create a goal and start building momentum.'}
          </p>
        </div>
        <Button
          onClick={() => openCreate()}
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" /> Add Goal
        </Button>
      </div>

      {/* Goal grid OR empty state */}
      {hasGoals ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {sortedGoals.map((goal, i) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              index={i}
              onAddFunds={openAddFunds}
              onEdit={openEdit}
              onDelete={openDelete}
            />
          ))}
        </div>
      ) : (
        <EmptyState onCreate={() => openCreate()} />
      )}

      {/* Popular goals suggestions */}
      <PopularGoals onPick={(p) => openCreate(p)} />

      {/* Add Funds dialog (remounted via key on each open) */}
      {addFundsOpen && addFundsGoal && (
        <AddFundsDialog
          key={`addfunds-${addFundsGoal.id}-${addFundsVersion}`}
          goal={addFundsGoal}
          open={addFundsOpen}
          onOpenChange={(o) => {
            setAddFundsOpen(o)
            if (!o) setAddFundsGoal(null)
          }}
        />
      )}

      {/* Goal form dialog (remounted via key on each open) */}
      {formOpen && (
        <GoalFormDialog
          key={`form-${formVersion}`}
          mode={formMode}
          goal={formGoal}
          preset={formPreset}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the goal and its saved progress. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteGoal.isPending}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleteGoal.isPending ? 'Deleting…' : 'Delete Goal'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
