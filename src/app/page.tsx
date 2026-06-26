'use client'

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
import { useAuth } from '@/lib/auth-client'
import { AuthScreen } from '@/components/budget/auth-screen'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp } from 'lucide-react'

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

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground animate-pulse">
          <TrendingUp className="h-6 w-6" />
        </div>
        <Skeleton className="h-4 w-32" />
      </div>
    )
  }

  if (!user) {
    return <AuthScreen />
  }

  const isAdmin = user.role === 'admin'
  return (
    <AppShell isAdmin={isAdmin} userName={user.name} userEmail={user.email} isDemo={user.isDemo}>
      <TabRouter isAdmin={isAdmin} />
    </AppShell>
  )
}
