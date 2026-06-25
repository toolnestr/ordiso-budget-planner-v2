'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/budget/app-shell'
import { useBudgetStore } from '@/lib/store'
import { DashboardTab } from '@/components/budget/tabs/dashboard-tab'
import { SetupTab } from '@/components/budget/tabs/setup-tab'
import { BudgetTab } from '@/components/budget/tabs/budget-tab'
import { TransactionsTab } from '@/components/budget/tabs/transactions-tab'
import { SavingsTab } from '@/components/budget/tabs/savings-tab'
import { DebtTab } from '@/components/budget/tabs/debt-tab'
import { ReportsTab } from '@/components/budget/tabs/reports-tab'
import { BillsTab } from '@/components/budget/tabs/bills-tab'
import { Skeleton } from '@/components/ui/skeleton'

function TabRouter() {
  const activeTab = useBudgetStore((s) => s.activeTab)
  switch (activeTab) {
    case 'dashboard': return <DashboardTab />
    case 'setup': return <SetupTab />
    case 'budget': return <BudgetTab />
    case 'transactions': return <TransactionsTab />
    case 'savings': return <SavingsTab />
    case 'debt': return <DebtTab />
    case 'reports': return <ReportsTab />
    case 'bills': return <BillsTab />
    default: return <DashboardTab />
  }
}

export default function Home() {
  const [bootstrapped, setBootstrapped] = useState(false)

  // Auto-seed on very first visit so the app isn't empty
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/seed')
        const data = await res.json()
        if (!cancelled && data.seeded === false) {
          await fetch('/api/seed', { method: 'POST' })
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setBootstrapped(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      <TabRouter />
    </AppShell>
  )
}
