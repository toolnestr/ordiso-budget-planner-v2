'use client'

import { useState } from 'react'
import {
  Settings as SettingsIcon, Plus, Pencil, Trash2, Landmark, PiggyBank, CreditCard, Banknote,
  Info, Tags, Sparkles, ArrowUpCircle, Coins, Wallet, Save,
} from 'lucide-react'
import {
  useSettings, useUpdateSettings,
  useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount,
  useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  useIncomeSources, useCreateIncome, useUpdateIncome, useDeleteIncome,
} from '@/lib/api-hooks'
import { colorHex, COLOR_KEYS, CATEGORY_ICONS } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type {
  Account, AccountType, Category, CategoryType, CategoryGroup,
  IncomeSource, IncomeType, Settings,
} from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Currency } from '@/components/budget/currency'
import type { LucideIcon } from 'lucide-react'

// ---------- Static maps ----------
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const ACCOUNT_ICONS: Record<AccountType, LucideIcon> = {
  CHECKING: Landmark,
  SAVINGS: PiggyBank,
  CREDIT: CreditCard,
  CASH: Banknote,
}

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  CHECKING: 'Checking',
  SAVINGS: 'Savings',
  CREDIT: 'Credit',
  CASH: 'Cash',
}

const ACCOUNT_TYPE_BADGE: Record<AccountType, string> = {
  CHECKING: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  SAVINGS: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
  CREDIT: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  CASH: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
}

const INCOME_TYPE_LABEL: Record<IncomeType, string> = {
  PRIMARY: 'Primary',
  SIDE: 'Side',
  PASSIVE: 'Passive',
}

const INCOME_TYPE_BADGE: Record<IncomeType, string> = {
  PRIMARY: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  SIDE: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  PASSIVE: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
}

const CATEGORY_GROUP_LABEL: Record<CategoryGroup, string> = {
  FIXED: 'Fixed',
  VARIABLE: 'Variable',
  SAVING: 'Saving',
  DEBT: 'Debt',
}

const CATEGORY_GROUP_BADGE: Record<CategoryGroup, string> = {
  FIXED: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  VARIABLE: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
  SAVING: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  DEBT: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
}

const SUGGESTED_CATEGORIES: { name: string; type: CategoryType; group: CategoryGroup; icon: string; color: string }[] = [
  { name: 'Pets', type: 'EXPENSE', group: 'VARIABLE', icon: '🐾', color: 'amber' },
  { name: 'Childcare', type: 'EXPENSE', group: 'FIXED', icon: '👶', color: 'pink' },
  { name: 'Medical / Health', type: 'EXPENSE', group: 'VARIABLE', icon: '🩺', color: 'rose' },
  { name: 'Education', type: 'EXPENSE', group: 'VARIABLE', icon: '🎓', color: 'violet' },
]

// ---------- Small shared bits ----------
function SectionHeader({ icon: Icon, title, description, action }: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

function EmptyState({ icon: Icon, title, description }: {
  icon: LucideIcon
  title: string
  description?: string
}) {
  return (
    <div className="text-center py-10 px-4">
      <div className="mx-auto mb-3 rounded-full bg-muted p-3 w-fit">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </div>
  )
}

function ColorSwatchPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_KEYS.map((key) => {
        const hex = colorHex(key)
        const selected = value === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-label={key}
            aria-pressed={selected}
            className={cn(
              'h-7 w-7 rounded-full border-2 transition-all',
              selected ? 'border-foreground scale-110 shadow-sm' : 'border-transparent hover:scale-105',
            )}
            style={{ backgroundColor: hex }}
          />
        )
      })}
    </div>
  )
}

function IconPicker({ value, onChange }: { value: string; onChange: (i: string) => void }) {
  return (
    <div className="grid grid-cols-10 gap-1.5 max-h-32 overflow-y-auto scrollbar-thin pr-1">
      {CATEGORY_ICONS.map((icon) => {
        const selected = value === icon
        return (
          <button
            key={icon}
            type="button"
            onClick={() => onChange(icon)}
            aria-label={`Icon ${icon}`}
            aria-pressed={selected}
            className={cn(
              'h-8 w-8 rounded-md text-base flex items-center justify-center transition-all',
              selected ? 'bg-primary/15 ring-2 ring-primary' : 'hover:bg-accent',
            )}
          >
            {icon}
          </button>
        )
      })}
    </div>
  )
}

// =====================================================================
// 1. PLANNER SETTINGS
// =====================================================================
function SettingsSection() {
  const { data: settings, isLoading } = useSettings()

  if (isLoading || !settings) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </div>
      </Card>
    )
  }

  return <SettingsForm key={settings.id} settings={settings} />
}

function SettingsForm({ settings }: { settings: Settings }) {
  const updateSettings = useUpdateSettings()

  const [plannerName, setPlannerName] = useState(settings.plannerName ?? '')
  const [currencySymbol, setCurrencySymbol] = useState(settings.currencySymbol ?? '$')
  const [currencyCode, setCurrencyCode] = useState(settings.currencyCode ?? 'USD')
  const [cashEnvelopeMode, setCashEnvelopeMode] = useState(settings.cashEnvelopeMode ?? false)
  const [weeklyCheckinDay, setWeeklyCheckinDay] = useState(settings.weeklyCheckinDay ?? 0)

  const handleSave = () => {
    updateSettings.mutate(
      { plannerName, currencySymbol, currencyCode, cashEnvelopeMode, weeklyCheckinDay },
      {
        onSuccess: () => toast.success('Settings saved'),
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const handleToggleCash = (checked: boolean) => {
    setCashEnvelopeMode(checked)
    updateSettings.mutate(
      { cashEnvelopeMode: checked },
      {
        onSuccess: () => toast.success(checked ? 'Cash Envelope Mode enabled' : 'Cash Envelope Mode disabled'),
        onError: (e) => {
          setCashEnvelopeMode(!checked)
          toast.error(e.message)
        },
      },
    )
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
      <SectionHeader
        icon={SettingsIcon}
        title="Planner Settings"
        description="Configure your budget workspace"
        action={
          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            <Save className="h-4 w-4 mr-1.5" /> Save Settings
          </Button>
        }
      />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5 lg:col-span-1">
          <Label htmlFor="plannerName">Planner Name</Label>
          <Input
            id="plannerName"
            value={plannerName}
            onChange={(e) => setPlannerName(e.target.value)}
            placeholder="My Budget"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currencySymbol">Currency Symbol</Label>
          <Input
            id="currencySymbol"
            value={currencySymbol}
            onChange={(e) => setCurrencySymbol(e.target.value)}
            maxLength={3}
            placeholder="$"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currencyCode">Currency Code</Label>
          <Input
            id="currencyCode"
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="USD"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weeklyCheckinDay">Weekly Check-in Day</Label>
          <Select value={String(weeklyCheckinDay)} onValueChange={(v) => setWeeklyCheckinDay(Number(v))}>
            <SelectTrigger id="weeklyCheckinDay" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((day, idx) => (
                <SelectItem key={day} value={String(idx)}>{day}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 lg:col-span-2 flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="cashEnvelopeMode" className="cursor-pointer">Cash Envelope Mode</Label>
            <p className="text-xs text-muted-foreground">Track physical cash separately from bank accounts</p>
          </div>
          <Switch
            id="cashEnvelopeMode"
            checked={cashEnvelopeMode}
            onCheckedChange={handleToggleCash}
            aria-label="Toggle cash envelope mode"
          />
        </div>
      </div>
    </div>
  )
}

// =====================================================================
// 2. INCOME SOURCES
// =====================================================================
function IncomeSection() {
  const { data: income, isLoading } = useIncomeSources()
  const createIncome = useCreateIncome()
  const updateIncome = useUpdateIncome()
  const deleteIncome = useDeleteIncome()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<IncomeSource | null>(null)
  const [dialogVersion, setDialogVersion] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<IncomeSource | null>(null)

  const openAdd = () => { setEditing(null); setDialogVersion((v) => v + 1); setDialogOpen(true) }
  const openEdit = (s: IncomeSource) => { setEditing(s); setDialogVersion((v) => v + 1); setDialogOpen(true) }

  return (
    <Card className="p-5">
      <SectionHeader
        icon={ArrowUpCircle}
        title="Income Sources"
        description="Where your money comes from"
        action={
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        }
      />
      <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 mb-4 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>Mark irregular income to plan conservatively — these won&apos;t be counted toward your baseline.</span>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !income || income.length === 0 ? (
        <EmptyState
          icon={ArrowUpCircle}
          title="No income sources yet"
          description="Add your first one to start planning your budget."
        />
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
          {income.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                  <Coins className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{s.name}</p>
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', INCOME_TYPE_BADGE[s.type])}>
                      {INCOME_TYPE_LABEL[s.type]}
                    </Badge>
                    {s.isIrregular && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                        Irregular
                      </Badge>
                    )}
                  </div>
                  {s.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{s.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  <Currency amount={s.expectedMonthly} />
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-600" onClick={() => setDeleteTarget(s)} aria-label={`Delete ${s.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <IncomeSourceDialog
        key={dialogVersion}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSubmit={(data) => {
          if (editing) {
            updateIncome.mutate({ id: editing.id, ...data }, {
              onSuccess: () => { toast.success('Income source updated'); setDialogOpen(false) },
              onError: (e) => toast.error(e.message),
            })
          } else {
            createIncome.mutate(data, {
              onSuccess: () => { toast.success('Income source added'); setDialogOpen(false) },
              onError: (e) => toast.error(e.message),
            })
          }
        }}
        pending={createIncome.isPending || updateIncome.isPending}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete income source?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{deleteTarget?.name}&quot;. Past transactions are not affected. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => {
                if (deleteTarget) {
                  deleteIncome.mutate(deleteTarget.id, {
                    onSuccess: () => { toast.success('Income source deleted'); setDeleteTarget(null) },
                    onError: (e) => toast.error(e.message),
                  })
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function IncomeSourceDialog({ open, onOpenChange, editing, onSubmit, pending }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  editing: IncomeSource | null
  onSubmit: (data: Partial<IncomeSource>) => void
  pending: boolean
}) {
  const [name, setName] = useState(editing?.name ?? '')
  const [type, setType] = useState<IncomeType>(editing?.type ?? 'PRIMARY')
  const [expectedMonthly, setExpectedMonthly] = useState(editing ? String(editing.expectedMonthly) : '')
  const [isIrregular, setIsIrregular] = useState(editing?.isIrregular ?? false)
  const [notes, setNotes] = useState(editing?.notes ?? '')

  const submit = () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    onSubmit({
      name: name.trim(),
      type,
      expectedMonthly: Number(expectedMonthly) || 0,
      isIrregular,
      notes: notes.trim() || null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Income Source' : 'Add Income Source'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Update the details of this income source.' : 'Track a new source of monthly income.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inc-name">Name</Label>
            <Input
              id="inc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Salary, Freelance, Rent"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as IncomeType)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMARY">Primary</SelectItem>
                  <SelectItem value="SIDE">Side</SelectItem>
                  <SelectItem value="PASSIVE">Passive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-amount">Expected Monthly</Label>
              <Input
                id="inc-amount"
                type="number"
                min="0"
                step="0.01"
                value={expectedMonthly}
                onChange={(e) => setExpectedMonthly(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-0.5 min-w-0">
              <Label htmlFor="inc-irregular" className="cursor-pointer">Irregular Income</Label>
              <p className="text-xs text-muted-foreground">For freelancers or variable income</p>
            </div>
            <Switch
              id="inc-irregular"
              checked={isIrregular}
              onCheckedChange={setIsIrregular}
              aria-label="Toggle irregular income"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc-notes">Notes (optional)</Label>
            <Textarea
              id="inc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Pay schedule, deductions, etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>{editing ? 'Save Changes' : 'Add Source'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================================
// 3. CATEGORIES
// =====================================================================
function CategoriesSection() {
  const { data: categories, isLoading } = useCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [preset, setPreset] = useState<Partial<Category> | null>(null)
  const [dialogVersion, setDialogVersion] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  const openAdd = () => { setEditing(null); setPreset(null); setDialogVersion((v) => v + 1); setDialogOpen(true) }
  const openEdit = (c: Category) => { setEditing(c); setPreset(null); setDialogVersion((v) => v + 1); setDialogOpen(true) }
  const openPreset = (s: { name: string; type: CategoryType; group: CategoryGroup; icon: string; color: string }) => {
    setEditing(null)
    setPreset(s)
    setDialogVersion((v) => v + 1)
    setDialogOpen(true)
  }

  const incomeCats = categories?.filter((c) => c.type === 'INCOME') ?? []
  const byGroup = (g: CategoryGroup) => categories?.filter((c) => c.type === 'EXPENSE' && c.group === g) ?? []

  const existingNames = new Set((categories ?? []).map((c) => c.name.toLowerCase()))
  const missingSuggestions = SUGGESTED_CATEGORIES.filter((s) => !existingNames.has(s.name.toLowerCase()))

  const toggleRollover = (c: Category, next: boolean) => {
    updateCategory.mutate({ id: c.id, rollover: next }, {
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <Card className="p-5">
      <SectionHeader
        icon={Tags}
        title="Categories"
        description="Organize your income and expenses"
        action={
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        }
      />

      {missingSuggestions.length > 0 && (
        <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2.5 mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Suggested categories you don&apos;t have yet
          </p>
          <div className="flex flex-wrap gap-2">
            {missingSuggestions.map((s) => (
              <button
                key={s.name}
                onClick={() => openPreset(s)}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs hover:bg-accent transition-colors"
              >
                <span>{s.icon}</span>
                <span>{s.name}</span>
                <Plus className="h-3 w-3 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : !categories || categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Add your first category to start organizing transactions."
        />
      ) : (
        <Tabs defaultValue="INCOME">
          <TabsList className="mb-4 w-full justify-start overflow-x-auto">
            <TabsTrigger value="INCOME" className="gap-1.5">
              Income
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{incomeCats.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="FIXED" className="gap-1.5">
              Fixed
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{byGroup('FIXED').length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="VARIABLE" className="gap-1.5">
              Variable
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{byGroup('VARIABLE').length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="SAVING" className="gap-1.5">
              Saving
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{byGroup('SAVING').length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="DEBT" className="gap-1.5">
              Debt
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{byGroup('DEBT').length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="INCOME">
            <CategoryList
              items={incomeCats}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onToggleRollover={toggleRollover}
              emptyMessage="No income categories yet."
            />
          </TabsContent>
          <TabsContent value="FIXED">
            <CategoryList
              items={byGroup('FIXED')}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onToggleRollover={toggleRollover}
              emptyMessage="No fixed expense categories yet."
            />
          </TabsContent>
          <TabsContent value="VARIABLE">
            <CategoryList
              items={byGroup('VARIABLE')}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onToggleRollover={toggleRollover}
              emptyMessage="No variable expense categories yet."
            />
          </TabsContent>
          <TabsContent value="SAVING">
            <CategoryList
              items={byGroup('SAVING')}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onToggleRollover={toggleRollover}
              emptyMessage="No saving categories yet."
            />
          </TabsContent>
          <TabsContent value="DEBT">
            <CategoryList
              items={byGroup('DEBT')}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onToggleRollover={toggleRollover}
              emptyMessage="No debt categories yet."
            />
          </TabsContent>
        </Tabs>
      )}

      <CategoryDialog
        key={dialogVersion}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        preset={preset}
        onSubmit={(data) => {
          if (editing) {
            updateCategory.mutate({ id: editing.id, ...data }, {
              onSuccess: () => { toast.success('Category updated'); setDialogOpen(false) },
              onError: (e) => toast.error(e.message),
            })
          } else {
            createCategory.mutate(data, {
              onSuccess: () => { toast.success('Category created'); setDialogOpen(false) },
              onError: (e) => toast.error(e.message),
            })
          }
        }}
        pending={createCategory.isPending || updateCategory.isPending}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting &quot;{deleteTarget?.name}&quot; will leave related transactions uncategorized. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => {
                if (deleteTarget) {
                  deleteCategory.mutate(deleteTarget.id, {
                    onSuccess: () => { toast.success('Category deleted'); setDeleteTarget(null) },
                    onError: (e) => toast.error(e.message),
                  })
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function CategoryList({ items, onEdit, onDelete, onToggleRollover, emptyMessage }: {
  items: Category[]
  onEdit: (c: Category) => void
  onDelete: (c: Category) => void
  onToggleRollover: (c: Category, next: boolean) => void
  emptyMessage: string
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
  }
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
      {items.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-base shrink-0"
              style={{ backgroundColor: `${colorHex(c.color)}1a` }}
            >
              <span aria-hidden>{c.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{c.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {c.type === 'INCOME' ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                    Income
                  </Badge>
                ) : (
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', CATEGORY_GROUP_BADGE[c.group])}>
                    {CATEGORY_GROUP_LABEL[c.group]}
                  </Badge>
                )}
                {c.isSystem && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20">
                    System
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <Label htmlFor={`roll-${c.id}`} className="text-xs text-muted-foreground hidden sm:block cursor-pointer">
                Rollover
              </Label>
              <Switch
                id={`roll-${c.id}`}
                checked={c.rollover}
                onCheckedChange={(v) => onToggleRollover(c, v)}
                aria-label={`Toggle rollover for ${c.name}`}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(c)} aria-label={`Edit ${c.name}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-600" onClick={() => onDelete(c)} aria-label={`Delete ${c.name}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CategoryDialog({ open, onOpenChange, editing, preset, onSubmit, pending }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  editing: Category | null
  preset: Partial<Category> | null
  onSubmit: (data: Partial<Category>) => void
  pending: boolean
}) {
  const src = editing ?? preset
  const [name, setName] = useState(src?.name ?? '')
  const [type, setType] = useState<CategoryType>(src?.type ?? 'EXPENSE')
  const [group, setGroup] = useState<CategoryGroup>(src?.group ?? 'VARIABLE')
  const [color, setColor] = useState(src?.color ?? 'emerald')
  const [icon, setIcon] = useState(src?.icon ?? '🏠')

  const submit = () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    onSubmit({
      name: name.trim(),
      type,
      group: type === 'INCOME' ? 'SAVING' : group,
      color,
      icon,
      rollover: false,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Update the details of this category.' : 'Create a new category for transactions.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Groceries, Rent, Salary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as CategoryType)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="INCOME">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === 'EXPENSE' && (
              <div className="space-y-1.5">
                <Label>Group</Label>
                <Select value={group} onValueChange={(v) => setGroup(v as CategoryGroup)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fixed</SelectItem>
                    <SelectItem value="VARIABLE">Variable</SelectItem>
                    <SelectItem value="SAVING">Saving</SelectItem>
                    <SelectItem value="DEBT">Debt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorSwatchPicker value={color} onChange={setColor} />
          </div>
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>{editing ? 'Save Changes' : 'Create Category'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================================
// 4. ACCOUNTS
// =====================================================================
function AccountsSection() {
  const { data: accounts, isLoading } = useAccounts()
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const deleteAccount = useDeleteAccount()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [dialogVersion, setDialogVersion] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)

  const openAdd = () => { setEditing(null); setDialogVersion((v) => v + 1); setDialogOpen(true) }
  const openEdit = (a: Account) => { setEditing(a); setDialogVersion((v) => v + 1); setDialogOpen(true) }

  return (
    <Card className="p-5">
      <SectionHeader
        icon={Wallet}
        title="Accounts"
        description="Bank, credit, and cash accounts"
        action={
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        }
      />
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !accounts || accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add your first account to start tracking balances."
        />
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
          {accounts.map((a) => {
            const Icon = ACCOUNT_ICONS[a.type] ?? Banknote
            const current = a.currentBalance ?? a.startingBalance
            const negative = current < 0
            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="rounded-lg p-2 shrink-0" style={{ backgroundColor: `${colorHex(a.color)}1a` }}>
                    <Icon className="h-4 w-4" style={{ color: colorHex(a.color) }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{a.name}</p>
                      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', ACCOUNT_TYPE_BADGE[a.type])}>
                        {ACCOUNT_TYPE_LABEL[a.type]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Start: <span className="tabular-nums"><Currency amount={a.startingBalance} /></span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Current</p>
                    <p className={cn('text-sm font-semibold tabular-nums', negative ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
                      <Currency amount={current} />
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)} aria-label={`Edit ${a.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-600" onClick={() => setDeleteTarget(a)} aria-label={`Delete ${a.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AccountDialog
        key={dialogVersion}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSubmit={(data) => {
          if (editing) {
            updateAccount.mutate({ id: editing.id, ...data }, {
              onSuccess: () => { toast.success('Account updated'); setDialogOpen(false) },
              onError: (e) => toast.error(e.message),
            })
          } else {
            createAccount.mutate(data, {
              onSuccess: () => { toast.success('Account added'); setDialogOpen(false) },
              onError: (e) => toast.error(e.message),
            })
          }
        }}
        pending={createAccount.isPending || updateAccount.isPending}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              Removing &quot;{deleteTarget?.name}&quot; will unlink related transactions from this account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => {
                if (deleteTarget) {
                  deleteAccount.mutate(deleteTarget.id, {
                    onSuccess: () => { toast.success('Account deleted'); setDeleteTarget(null) },
                    onError: (e) => toast.error(e.message),
                  })
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function AccountDialog({ open, onOpenChange, editing, onSubmit, pending }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  editing: Account | null
  onSubmit: (data: Partial<Account>) => void
  pending: boolean
}) {
  const [name, setName] = useState(editing?.name ?? '')
  const [type, setType] = useState<AccountType>(editing?.type ?? 'CHECKING')
  const [startingBalance, setStartingBalance] = useState(editing ? String(editing.startingBalance) : '')
  const [color, setColor] = useState(editing?.color ?? 'emerald')

  const submit = () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    onSubmit({
      name: name.trim(),
      type,
      startingBalance: Number(startingBalance) || 0,
      color,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Account' : 'Add Account'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Update the details of this account.' : 'Track balances for a bank, credit, or cash account.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="acc-name">Account Name</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Checking, Chase Sapphire"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHECKING">Checking</SelectItem>
                  <SelectItem value="SAVINGS">Savings</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-balance">Starting Balance</Label>
              <Input
                id="acc-balance"
                type="number"
                step="0.01"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorSwatchPicker value={color} onChange={setColor} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>{editing ? 'Save Changes' : 'Add Account'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =====================================================================
// MAIN
// =====================================================================
export function SetupTab() {
  return (
    <div className="space-y-6">
      <SettingsSection />
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <IncomeSection />
        <AccountsSection />
      </div>
      <CategoriesSection />
    </div>
  )
}
