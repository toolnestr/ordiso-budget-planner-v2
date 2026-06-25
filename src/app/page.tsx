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
import { FirestoreSetupScreen } from '@/components/budget/firestore-setup-screen'

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

type Status = 'checking' | 'ready' | 'setup-required'

/** Probe Firestore connectivity and auto-seed on first run. Returns the resulting status. */
async function probeAndSeed(): Promise<Status> {
  try {
    // Firestore requests can hang for a long time when the API is disabled
    // (the SDK retries internally). Abort after 9s so the setup screen shows
    // promptly instead of leaving the user on a spinner.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 9000)
    const res = await fetch('/api/seed', { cache: 'no-store', signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return 'setup-required'
    const data = await res.json()
    if (data.seeded === false) {
      const seedController = new AbortController()
      const seedTimeout = setTimeout(() => seedController.abort(), 30000)
      const seedRes = await fetch('/api/seed', { method: 'POST', signal: seedController.signal })
      clearTimeout(seedTimeout)
      if (!seedRes.ok) return 'setup-required'
    }
    return 'ready'
  } catch {
    return 'setup-required'
  }
}

export default function Home() {
  const [status, setStatus] = useState<Status>('checking')
  const [retrying, setRetrying] = useState(false)

  // Run the connectivity probe + auto-seed on mount. setState happens in the
  // async callback (not synchronously in the effect body), which is the
  // React-recommended pattern for syncing with external systems.
  useEffect(() => {
    let cancelled = false
    probeAndSeed().then((s) => {
      if (!cancelled) setStatus(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleRetry() {
    setRetrying(true)
    const s = await probeAndSeed()
    setStatus(s)
    setRetrying(false)
  }

  if (status === 'checking') {
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

  if (status === 'setup-required') {
    return <FirestoreSetupScreen onRetry={handleRetry} retrying={retrying} />
  }

  return (
    <AppShell>
      <TabRouter />
    </AppShell>
  )
}
