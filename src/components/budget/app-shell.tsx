'use client'

import { useState, useSyncExternalStore } from 'react'
import {
  LayoutDashboard, Settings, Wallet, Receipt, Target, CreditCard, BarChart3, CalendarClock,
  Menu, Moon, Sun, Sparkles, TrendingUp, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useBudgetStore, type TabId } from '@/lib/store'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useSettings, useSeed } from '@/lib/api-hooks'
import { monthName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const NAV_ITEMS: { id: TabId; label: string; icon: typeof LayoutDashboard; desc: string }[] = [
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
  // useSyncExternalStore is the React-recommended hydration-safe mount check
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  if (!mounted) return <div className="h-9 w-9" />
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const activeTab = useBudgetStore((s) => s.activeTab)
  const setActiveTab = useBudgetStore((s) => s.setActiveTab)
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
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
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
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
        <p className="font-bold text-base leading-tight truncate">{settings?.plannerName ?? 'FinFlow'}</p>
        <p className="text-[11px] text-muted-foreground">Budget Planner</p>
      </div>
    </div>
  )
}

function MonthNav() {
  const { month, year, prevMonth, nextMonth } = useBudgetStore()
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth} aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-semibold min-w-[110px] text-center tabular-nums">{monthName(month)} {year}</span>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth} aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const activeTab = useBudgetStore((s) => s.activeTab)
  const seed = useSeed()
  const [seeding, setSeeding] = useState(false)

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await seed.mutateAsync()
      toast.success((res as { message?: string })?.message ?? 'Sample data loaded!')
    } catch (e) {
      toast.error('Failed to seed: ' + (e as Error).message)
    } finally {
      setSeeding(false)
    }
  }

  const showMonthNav = ['dashboard', 'budget', 'transactions'].includes(activeTab)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 backdrop-blur px-4 py-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="text-left">
              <SheetTitle asChild><div><Brand /></div></SheetTitle>
            </SheetHeader>
            <div className="mt-2"><NavList onNavigate={() => setMobileOpen(false)} /></div>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingUp className="h-4 w-4" />
          </div>
          <span className="font-bold text-sm">FinFlow</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-64 lg:w-72 flex-col border-r bg-sidebar/50 shrink-0 sticky top-0 h-screen">
          <Brand />
          <NavList />
          <div className="mt-auto p-4 space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleSeed}
              disabled={seeding}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {seeding ? 'Loading…' : 'Load Sample Data'}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center px-2">
              Your data stays private in your browser.
            </p>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
            {/* Desktop contextual header */}
            <div className="hidden md:flex items-center justify-between mb-6">
              {showMonthNav ? <MonthNav /> : <div />}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleSeed} disabled={seeding}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {seeding ? 'Loading…' : 'Sample Data'}
                </Button>
                <ThemeToggle />
              </div>
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
              <p>© {new Date().getFullYear()} FinFlow Budget Planner. Take control of your money.</p>
              <p className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Auto-saving your progress locally
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
