'use client'

import { useState, useSyncExternalStore } from 'react'
import { useAuth } from '@/lib/auth-client'
import {
  LayoutDashboard, Settings, Wallet, Receipt, Target, CreditCard, BarChart3, CalendarClock,
  Menu, Moon, Sun, TrendingUp, ChevronLeft, ChevronRight, LogOut, Shield, KeyRound, Loader2,
} from 'lucide-react'
import { useBudgetStore, type TabId } from '@/lib/store'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useSettings } from '@/lib/api-hooks'
import { monthName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const USER_NAV: { id: TabId; label: string; icon: typeof LayoutDashboard; desc: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Financial overview' },
  { id: 'budget', label: 'Monthly Budget', icon: Wallet, desc: 'Plan & track spending' },
  { id: 'transactions', label: 'Transactions', icon: Receipt, desc: 'Log daily spending' },
  { id: 'savings', label: 'Savings Goals', icon: Target, desc: 'Sinking funds & goals' },
  { id: 'debt', label: 'Debt Payoff', icon: CreditCard, desc: 'Snowball & avalanche' },
  { id: 'bills', label: 'Bills & Subs', icon: CalendarClock, desc: 'Subscriptions tracker' },
  { id: 'reports', label: 'Annual Review', icon: BarChart3, desc: 'Yearly trends' },
  { id: 'setup', label: 'Setup', icon: Settings, desc: 'Categories & accounts' },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  if (!mounted) return <div className="h-9 w-9" />
  return (
    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function NavList({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const activeTab = useBudgetStore((s) => s.activeTab)
  const setActiveTab = useBudgetStore((s) => s.setActiveTab)
  const items = isAdmin ? [...USER_NAV, { id: 'admin' as TabId, label: 'Admin Console', icon: Shield, desc: 'Manage users' }] : USER_NAV
  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const Icon = item.icon
        const active = activeTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id); onNavigate?.() }}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              item.id === 'admin' && !active && 'text-amber-600 dark:text-amber-400'
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground')} />
            <div className="flex flex-col items-start min-w-0">
              <span className="truncate">{item.label}</span>
              <span className={cn('text-[10px] truncate', active ? 'text-primary-foreground/70' : 'text-muted-foreground/70')}>{item.desc}</span>
            </div>
          </button>
        )
      })}
    </nav>
  )
}

function Brand() {
  const { data: settings } = useSettings()
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <TrendingUp className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="font-bold text-base leading-tight truncate">{settings?.plannerName ?? 'Ordiso'}</p>
        <p className="text-[11px] text-muted-foreground">Budget Planner</p>
      </div>
    </div>
  )
}

function MonthNav() {
  const { month, year, prevMonth, nextMonth } = useBudgetStore()
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8" onClick={prevMonth} aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-semibold min-w-[110px] text-center tabular-nums">{monthName(month)} {year}</span>
      <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-8 sm:w-8" onClick={nextMonth} aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

function UserMenu({ userName, userEmail, isAdmin }: { userName: string; userEmail: string; isAdmin: boolean }) {
  const { signOut, changePassword } = useAuth()
  const [pwOpen, setPwOpen] = useState(false)
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwLoading, setPwLoading] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError(null)
    if (!curPw || !newPw || !confirmPw) { setPwError('All fields are required.'); return }
    if (newPw.length < 6) { setPwError('New password must be at least 6 characters.'); return }
    if (newPw !== confirmPw) { setPwError('New passwords do not match.'); return }
    setPwLoading(true)
    try {
      await changePassword(curPw, newPw)
      toast.success('Password changed successfully')
      setPwOpen(false)
      setCurPw(''); setNewPw(''); setConfirmPw('')
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      if (code.includes('wrong-password') || code.includes('invalid-credential')) {
        setPwError('Current password is incorrect.')
      } else if (code.includes('too-many-requests')) {
        setPwError('Too many attempts. Try again later.')
      } else if (code.includes('weak-password')) {
        setPwError('New password is too weak. Use at least 6 characters.')
      } else {
        setPwError((err as Error).message || 'Could not change password.')
      }
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent transition-colors min-h-[40px]" aria-label="User menu">
            <Avatar className="h-7 w-7">
              <AvatarFallback className={cn('text-xs font-semibold', isAdmin ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-primary/15 text-primary')}>
                {initials(userName)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:flex flex-col items-start min-w-0 max-w-[140px]">
              <span className="text-xs font-medium truncate w-full text-left">{userName}</span>
              <span className="text-[10px] text-muted-foreground truncate w-full text-left">{userEmail}</span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-medium truncate">{userName}</span>
            <span className="text-xs text-muted-foreground font-normal truncate">{userEmail}</span>
            {isAdmin && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">Administrator</span>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setPwOpen(true); setPwError(null); setCurPw(''); setNewPw(''); setConfirmPw('') }} className="cursor-pointer">
            <KeyRound className="h-4 w-4 mr-2" />
            Change password
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut()} className="text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400 cursor-pointer">
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Change password dialog */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cur-pw">Current password</Label>
              <Input id="cur-pw" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New password</Label>
              <Input id="new-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" placeholder="At least 6 characters" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw">Confirm new password</Label>
              <Input id="confirm-pw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
            </div>
            {pwError && <p role="alert" className="text-sm font-medium text-rose-600 dark:text-rose-400">{pwError}</p>}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" disabled={pwLoading}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={pwLoading} className="gap-2">
                {pwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {pwLoading ? 'Saving…' : 'Update password'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function AppShell({
  children,
  isAdmin,
  userName,
  userEmail,
  isDemo,
}: {
  children: React.ReactNode
  isAdmin: boolean
  userName: string
  userEmail: string
  isDemo: boolean
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const activeTab = useBudgetStore((s) => s.activeTab)
  const showMonthNav = ['dashboard', 'budget', 'transactions'].includes(activeTab)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Demo-mode banner */}
      {isDemo && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs text-center py-1.5 px-4 font-medium">
          Demo Mode — data is read-only. Sign up for a real account to edit.
        </div>
      )}
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 py-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="text-left">
              <SheetTitle asChild><div><Brand /></div></SheetTitle>
            </SheetHeader>
            <div className="mt-2"><NavList isAdmin={isAdmin} onNavigate={() => setMobileOpen(false)} /></div>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingUp className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm">Ordiso</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu userName={userName} userEmail={userEmail} isAdmin={isAdmin} />
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-64 lg:w-72 flex-col border-r bg-sidebar/50 shrink-0 sticky top-0 h-screen">
          <Brand />
          <NavList isAdmin={isAdmin} />
          <div className="mt-auto p-3 border-t">
            <UserMenu userName={userName} userEmail={userEmail} isAdmin={isAdmin} />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
            {/* Desktop contextual header */}
            <div className="hidden md:flex items-center justify-between mb-6">
              {showMonthNav ? <MonthNav /> : <div />}
              <ThemeToggle />
            </div>
            {/* Mobile month nav */}
            {showMonthNav && (
              <div className="md:hidden mb-4"><MonthNav /></div>
            )}
            {children}
          </main>

          {/* Sticky footer */}
          <footer className="mt-auto border-t bg-card/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>© {new Date().getFullYear()} Ordiso Budget Planner. Take control of your money.</p>
              <p className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Signed in as {userName}
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
