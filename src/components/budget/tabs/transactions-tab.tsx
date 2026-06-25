'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDownCircle, ArrowUpCircle, Plus, Split as SplitIcon, MoreVertical,
  Pencil, Trash2, CheckCircle2, Search, Loader2, Sparkles, Receipt, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Currency } from '@/components/budget/currency'
import { useBudgetStore } from '@/lib/store'
import {
  useTransactions, useCreateTransaction, useUpdateTransaction, useDeleteTransaction,
  useCategories, useAccounts,
} from '@/lib/api-hooks'
import { colorHex, guessCategory, formatDate } from '@/lib/format'
import type { Transaction, Category, Account } from '@/lib/types'

// ---------------- Helpers ----------------

function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDate(s: string): Date {
  if (s.includes('T')) return new Date(s)
  return new Date(s + 'T00:00:00')
}

function dateLabel(dateStr: string): string {
  const d = parseDate(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.getTime() === today.getTime()) return 'Today'
  if (d.getTime() === yesterday.getTime()) return 'Yesterday'
  return formatDate(d, 'long')
}

function isToday(dateStr: string): boolean {
  const d = parseDate(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d.getTime() === today.getTime()
}

type QuickType = 'EXPENSE' | 'INCOME'

// ---------------- Type Toggle ----------------

function TypeToggle({ value, onChange }: { value: QuickType; onChange: (v: QuickType) => void }) {
  return (
    <div className="inline-flex rounded-md border bg-muted/30 p-0.5 w-full">
      <button
        type="button"
        onClick={() => onChange('EXPENSE')}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors flex-1',
          value === 'EXPENSE' ? 'bg-rose-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <ArrowDownCircle className="h-4 w-4" />Expense
      </button>
      <button
        type="button"
        onClick={() => onChange('INCOME')}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors flex-1',
          value === 'INCOME' ? 'bg-emerald-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <ArrowUpCircle className="h-4 w-4" />Income
      </button>
    </div>
  )
}

// ---------------- Main Component ----------------

export function TransactionsTab() {
  const { month, year } = useBudgetStore()
  const { data: transactions, isLoading } = useTransactions(month, year)
  const { data: categories } = useCategories()
  const { data: accounts } = useAccounts()
  const createMut = useCreateTransaction()
  const updateMut = useUpdateTransaction()
  const deleteMut = useDeleteTransaction()

  // Quick-add form state
  const [type, setType] = useState<QuickType>('EXPENSE')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountIdOverride, setAccountIdOverride] = useState<string | null>(null)
  const [date, setDate] = useState<string>(todayStr())
  const [autoHint, setAutoHint] = useState<string | null>(null)

  // Dialog state
  const [splitOpen, setSplitOpen] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null)

  // Filter state
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')

  // Derived: default to first account, allow user override
  const accountId = accountIdOverride ?? accounts?.[0]?.id ?? ''

  const filteredCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === type),
    [categories, type]
  )

  const handleTypeChange = (newType: QuickType) => {
    setType(newType)
    const stillValid = (categories ?? []).some((c) => c.id === categoryId && c.type === newType)
    if (!stillValid) {
      setCategoryId('')
      setAutoHint(null)
    }
  }

  const handleDescriptionChange = (val: string) => {
    setDescription(val)
    const guessed = guessCategory(val)
    if (guessed) {
      const cat = (categories ?? []).find((c) => c.name === guessed)
      if (cat) {
        if (cat.type !== type) setType(cat.type)
        setCategoryId(cat.id)
        setAutoHint(cat.name)
        return
      }
    }
    setAutoHint(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || !amount) {
      toast.error('Please enter a description and amount')
      return
    }
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    createMut.mutate(
      { date, description: description.trim(), amount: amt, type, categoryId, accountId },
      {
        onSuccess: () => {
          toast.success('Transaction added', { description: description.trim() })
          setDescription('')
          setAmount('')
          setCategoryId('')
          setAutoHint(null)
          // Keep type + date for rapid logging
        },
        onError: (err) => toast.error('Failed to add', { description: err.message }),
      }
    )
  }

  // Client-side filtering
  const filtered = useMemo(() => {
    return (transactions ?? []).filter((t) => {
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false
      if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false
      if (accountFilter !== 'all' && t.accountId !== accountFilter) return false
      return true
    })
  }, [transactions, search, categoryFilter, accountFilter])

  // Summary
  const summary = useMemo(() => {
    let income = 0
    let expenses = 0
    for (const t of transactions ?? []) {
      if (t.type === 'INCOME') income += t.amount
      else if (t.type === 'EXPENSE') expenses += t.amount
    }
    return { income, expenses, net: income - expenses }
  }, [transactions])

  // Group by date (input is already sorted desc by date)
  const grouped = useMemo(() => {
    const groups: { date: string; label: string; transactions: Transaction[] }[] = []
    for (const tx of filtered) {
      const dateKey = tx.date.split('T')[0]
      let group = groups.find((g) => g.date === dateKey)
      if (!group) {
        group = { date: dateKey, label: dateLabel(dateKey), transactions: [] }
        groups.push(group)
      }
      group.transactions.push(tx)
    }
    return groups
  }, [filtered])

  const toggleReconciled = (tx: Transaction) => {
    updateMut.mutate(
      { id: tx.id, isReconciled: !tx.isReconciled },
      {
        onSuccess: () => toast.success(tx.isReconciled ? 'Marked unreconciled' : 'Marked reconciled'),
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const handleDelete = () => {
    if (!deleteTx) return
    deleteMut.mutate(deleteTx.id, {
      onSuccess: () => {
        toast.success('Transaction deleted')
        setDeleteTx(null)
      },
      onError: (err) => toast.error(err.message),
    })
  }

  const clearFilters = () => {
    setSearch('')
    setCategoryFilter('all')
    setAccountFilter('all')
  }

  const hasFilters = search !== '' || categoryFilter !== 'all' || accountFilter !== 'all'

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ---------- Quick-Add Card ---------- */}
      <Card className="p-4 sm:p-5 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />Quick Add
            </h2>
            <p className="text-xs text-muted-foreground">Log a transaction in seconds</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            {/* Type toggle */}
            <div className="w-full sm:w-auto sm:min-w-[210px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
              <TypeToggle value={type} onChange={handleTypeChange} />
            </div>
            {/* Description */}
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
              <Input
                value={description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="e.g. Starbucks coffee"
                autoFocus
              />
              {autoHint && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />auto: {autoHint}
                </p>
              )}
            </div>
            {/* Amount */}
            <div className="w-full sm:w-32">
              <Label className="text-xs text-muted-foreground mb-1 block">Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="tabular-nums"
              />
            </div>
            {/* Category */}
            <div className="w-full sm:w-48">
              <Label className="text-xs text-muted-foreground mb-1 block">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No {type === 'INCOME' ? 'income' : 'expense'} categories yet
                    </div>
                  ) : (
                    filteredCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="mr-1">{c.icon}</span>
                        {c.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {/* Account */}
            <div className="w-full sm:w-40">
              <Label className="text-xs text-muted-foreground mb-1 block">Account</Label>
              <Select value={accountId} onValueChange={(v) => setAccountIdOverride(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No accounts yet
                    </div>
                  ) : (
                    accounts?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {/* Date */}
            <div className="w-full sm:w-36">
              <Label className="text-xs text-muted-foreground mb-1 block">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {/* Add */}
            <Button type="submit" disabled={createMut.isPending} className="h-9">
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
          <div className="flex justify-between items-center">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-7 px-2 text-muted-foreground"
              onClick={() => setSplitOpen(true)}
            >
              <SplitIcon className="h-3.5 w-3.5 mr-1" />Split transaction
            </Button>
            <p className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
              Press
              <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[10px] font-mono">Enter</kbd>
              to add
            </p>
          </div>
        </form>
      </Card>

      {/* ---------- Summary Strip ---------- */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 bg-emerald-500/5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase">Income</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
            <Currency amount={summary.income} />
          </p>
        </div>
        <div className="rounded-lg border p-3 bg-rose-500/5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase">Expenses</p>
          <p className="text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums mt-0.5">
            <Currency amount={summary.expenses} />
          </p>
        </div>
        <div className="rounded-lg border p-3 bg-primary/5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase">Net</p>
          <p
            className={cn(
              'text-lg font-bold tabular-nums mt-0.5',
              summary.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            )}
          >
            <Currency amount={summary.net} sign />
          </p>
        </div>
      </div>

      {/* ---------- Filter Bar ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions..."
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48 h-9">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(categories ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="mr-1">{c.icon}</span>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-full sm:w-40 h-9">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {(accounts ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
            <X className="h-4 w-4 mr-1" />Clear
          </Button>
        )}
      </div>

      {/* ---------- Transaction List ---------- */}
      <Card className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Transactions
          </h3>
          <Badge variant="secondary" className="text-xs">
            {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
          </Badge>
        </div>

        {(transactions ?? []).length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📝</div>
            <p className="font-medium text-sm">No transactions yet this month</p>
            <p className="text-xs text-muted-foreground mt-1">Add your first one above!</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No transactions match your filters.</p>
            <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto scrollbar-thin pr-1">
            {grouped.map((group, gi) => (
              <div key={group.date} className={gi > 0 ? 'mt-4' : ''}>
                {/* Sticky date header */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-1 py-2 -mx-1 border-b">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                </div>
                <div className="space-y-1.5 mt-2">
                  {group.transactions.map((tx, idx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      index={idx}
                      onEdit={() => setEditTx(tx)}
                      onDelete={() => setDeleteTx(tx)}
                      onToggleReconciled={() => toggleReconciled(tx)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ---------- Split Dialog ---------- */}
      <SplitDialog
        open={splitOpen}
        onOpenChange={setSplitOpen}
        categories={categories ?? []}
        accounts={accounts ?? []}
        defaultAccountId={accountId}
        onCreate={(data) =>
          createMut.mutate(data, {
            onSuccess: () => {
              toast.success('Split transaction added', { description: String(data.description) })
              setSplitOpen(false)
            },
            onError: (err) => toast.error(err.message),
          })
        }
        isPending={createMut.isPending}
      />

      {/* ---------- Edit Dialog ---------- */}
      <EditTransactionDialog
        tx={editTx}
        open={!!editTx}
        onOpenChange={(open) => {
          if (!open) setEditTx(null)
        }}
        categories={categories ?? []}
        accounts={accounts ?? []}
        onUpdate={(data) =>
          updateMut.mutate(data, {
            onSuccess: () => {
              toast.success('Transaction updated')
              setEditTx(null)
            },
            onError: (err) => toast.error(err.message),
          })
        }
        isPending={updateMut.isPending}
      />

      {/* ---------- Delete AlertDialog ---------- */}
      <AlertDialog
        open={!!deleteTx}
        onOpenChange={(open) => {
          if (!open) setDeleteTx(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTx
                ? `This will permanently delete "${deleteTx.description}". This action cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-500 hover:bg-rose-600 text-white focus-visible:ring-rose-500/30"
            >
              {deleteMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------- Transaction Row ----------------

function TransactionRow({
  tx,
  index,
  onEdit,
  onDelete,
  onToggleReconciled,
}: {
  tx: Transaction
  index: number
  onEdit: () => void
  onDelete: () => void
  onToggleReconciled: () => void
}) {
  const today = isToday(tx.date)
  const icon = tx.category?.icon ?? (tx.type === 'INCOME' ? '💰' : '💸')
  const color = tx.category?.color ?? 'slate'

  const amountClass =
    tx.type === 'INCOME'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tx.type === 'EXPENSE'
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-slate-600 dark:text-slate-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.15) }}
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 transition-colors group',
        today ? 'border-l-2 border-l-emerald-500 bg-emerald-500/[0.03]' : 'border-border',
        'hover:bg-accent/40'
      )}
    >
      {/* Category icon */}
      <div
        className="rounded-full h-9 w-9 flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${colorHex(color)}1a` }}
      >
        <span className="text-base leading-none">{icon}</span>
      </div>

      {/* Description + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-medium text-sm truncate">{tx.description}</p>
          {tx.isSplit && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 gap-0.5">
              <SplitIcon className="h-2.5 w-2.5" />Split
            </Badge>
          )}
          {tx.isReconciled && (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {tx.category?.name ?? 'Uncategorized'}
          {tx.account?.name && <span> · {tx.account.name}</span>}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <Currency
          amount={tx.type === 'EXPENSE' ? -tx.amount : tx.amount}
          sign={tx.type === 'INCOME'}
          className={cn('font-semibold text-sm', amountClass)}
        />
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4" />Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleReconciled}>
            <CheckCircle2 className="h-4 w-4" />
            {tx.isReconciled ? 'Mark unreconciled' : 'Mark reconciled'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  )
}

// ---------------- Split Dialog ----------------

function SplitDialog({
  open,
  onOpenChange,
  categories,
  accounts,
  defaultAccountId,
  onCreate,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  accounts: Account[]
  defaultAccountId: string
  onCreate: (data: Record<string, unknown>) => void
  isPending: boolean
}) {
  const [description, setDescription] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [type, setType] = useState<QuickType>('EXPENSE')
  const [date, setDate] = useState<string>(todayStr())
  const [accountIdOverride, setAccountIdOverride] = useState<string | null>(null)
  const [items, setItems] = useState([
    { categoryId: '', amount: '' },
    { categoryId: '', amount: '' },
  ])

  // Derived: default account from parent, allow user override, fallback to first account
  const accountId = accountIdOverride ?? defaultAccountId ?? accounts[0]?.id ?? ''

  // Reset state after close animation
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setDescription('')
        setTotalAmount('')
        setType('EXPENSE')
        setDate(todayStr())
        setAccountIdOverride(null)
        setItems([
          { categoryId: '', amount: '' },
          { categoryId: '', amount: '' },
        ])
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [open, defaultAccountId])

  const filteredCategories = categories.filter((c) => c.type === type)
  const allocated = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const total = parseFloat(totalAmount) || 0
  const remaining = Math.round((total - allocated) * 100) / 100

  const updateItem = (idx: number, field: 'categoryId' | 'amount', value: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  const addItem = () => setItems((prev) => [...prev, { categoryId: '', amount: '' }])
  const removeItem = (idx: number) => {
    if (items.length <= 2) return
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const canSubmit =
    description.trim() !== '' &&
    total > 0 &&
    items.length >= 2 &&
    items.every((i) => i.categoryId !== '' && parseFloat(i.amount) > 0) &&
    Math.abs(remaining) < 0.01 &&
    accountId !== ''

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    onCreate({
      date,
      description: description.trim(),
      type,
      accountId,
      isSplit: true,
      splits: items.map((i) => ({ categoryId: i.categoryId, amount: parseFloat(i.amount) })),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SplitIcon className="h-4 w-4 text-primary" />Split Transaction
          </DialogTitle>
          <DialogDescription>
            Break down a single purchase across multiple categories.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Costco run"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Total Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                className="tabular-nums"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Type</Label>
              <TypeToggle
                value={type}
                onChange={(t) => {
                  setType(t)
                  setItems((prev) => prev.map((i) => ({ ...i, categoryId: '' })))
                }}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Account</Label>
              <Select value={accountId} onValueChange={(v) => setAccountIdOverride(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" />Add item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Select
                    value={item.categoryId}
                    onValueChange={(v) => updateItem(idx, 'categoryId', v)}
                  >
                    <SelectTrigger className="flex-1 h-9">
                      <SelectValue placeholder="Category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="mr-1">{c.icon}</span>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="w-28 shrink-0">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.amount}
                      onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="h-9 tabular-nums"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => removeItem(idx)}
                    disabled={items.length <= 2}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Allocation summary */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium tabular-nums">{total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Allocated</span>
              <span className="font-medium tabular-nums">{allocated.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-1 mt-1">
              <span className="text-muted-foreground">Remaining</span>
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  Math.abs(remaining) < 0.01
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                )}
              >
                {remaining.toFixed(2)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1" />
              )}
              Create split
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Edit Transaction Dialog ----------------

function EditTransactionDialog({
  tx,
  open,
  onOpenChange,
  categories,
  accounts,
  onUpdate,
  isPending,
}: {
  tx: Transaction | null
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  accounts: Account[]
  onUpdate: (data: Record<string, unknown> & { id: string }) => void
  isPending: boolean
}) {
  if (!tx) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />Edit Transaction
          </DialogTitle>
          <DialogDescription>Update the details of this transaction.</DialogDescription>
        </DialogHeader>
        <EditForm
          key={tx.id}
          tx={tx}
          categories={categories}
          accounts={accounts}
          onSubmit={onUpdate}
          isPending={isPending}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function EditForm({
  tx,
  categories,
  accounts,
  onSubmit,
  isPending,
  onCancel,
}: {
  tx: Transaction
  categories: Category[]
  accounts: Account[]
  onSubmit: (data: Record<string, unknown> & { id: string }) => void
  isPending: boolean
  onCancel: () => void
}) {
  const [type, setType] = useState<QuickType>(tx.type === 'INCOME' ? 'INCOME' : 'EXPENSE')
  const [description, setDescription] = useState(tx.description)
  const [amount, setAmount] = useState(String(tx.amount))
  const [categoryId, setCategoryId] = useState(tx.categoryId ?? '')
  const [accountId, setAccountId] = useState(tx.accountId ?? '')
  const [date, setDate] = useState<string>(tx.date.split('T')[0])
  const [notes, setNotes] = useState(tx.notes ?? '')

  const filteredCategories = categories.filter((c) => c.type === type)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || !amount) return
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return
    onSubmit({
      id: tx.id,
      date,
      description: description.trim(),
      amount: amt,
      type,
      categoryId,
      accountId,
      notes: notes.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-xs mb-1 block">Type</Label>
        <TypeToggle
          value={type}
          onChange={(t) => {
            setType(t)
            const stillValid = categories.some((c) => c.id === categoryId && c.type === t)
            if (!stillValid) setCategoryId('')
          }}
        />
      </div>
      <div>
        <Label className="text-xs mb-1 block">Description</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Amount</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tabular-nums"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs mb-1 block">Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="mr-1">{c.icon}</span>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs mb-1 block">Notes</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-1" />
          )}
          Save changes
        </Button>
      </DialogFooter>
    </form>
  )
}
