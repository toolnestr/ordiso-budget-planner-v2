'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
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
import { AdminTab } from '@/components/budget/tabs/admin-tab'
import { Skeleton } from '@/components/ui/skeleton'
import { FirestoreSetupScreen } from '@/components/budget/firestore-setup-screen'
import { AuthScreen } from '@/components/budget/auth-screen'

function TabRouter({ isAdmin }: { isAdmin: boolean }) {
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
    case 'admin': return isAdmin ? <AdminTab /> : <DashboardTab />
    default: return <DashboardTab />
  }
}

type FsStatus = 'checking' | 'ready' | 'setup-required'

/** Probe Firestore connectivity and auto-seed users on first run. */
async function probeAndSeed(): Promise<FsStatus> {
  try {
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
  const [fsStatus, setFsStatus] = useState<FsStatus>('checking')
  const [retrying, setRetrying] = useState(false)
  const { data: session, status: sessionStatus } = useSession()

  useEffect(() => {
    let cancelled = false
    probeAndSeed().then((s) => {
      if (!cancelled) setFsStatus(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleRetry() {
    setRetrying(true)
    const s = await probeAndSeed()
    setFsStatus(s)
    setRetrying(false)
  }

  // 1. Firestore not ready yet
  if (fsStatus === 'checking') {
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

  if (fsStatus === 'setup-required') {
    return <FirestoreSetupScreen onRetry={handleRetry} retrying={retrying} />
  }

  // 2. Firestore ready — check auth state
  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Skeleton className="h-10 w-32" />
      </div>
    )
  }

  // 3. Not authenticated → show login/signup
  if (!session) {
    return <AuthScreen />
  }

  // 4. Authenticated → show the app (admin tab gated by role)
  const isAdmin = session.user.role === 'admin'
  return (
    <AppShell isAdmin={isAdmin} userName={session.user.name ?? session.user.email} userEmail={session.user.email}>
      <TabRouter isAdmin={isAdmin} />
    </AppShell>
  )
}
