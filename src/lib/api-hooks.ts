'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './auth-client'
import * as db from './db'
import { getDashboard, getBudgetRows, getReport } from './aggregation'
import type {
  Settings, Account, Category, IncomeSource, Transaction, SavingsGoal, Debt, Bill,
} from './types'

// All hooks read the current user from the AuthProvider context and pass
// userId into the client-side Firestore data layer. No API routes involved.

// ---------- Settings ----------
export function useSettings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['settings', user?.uid],
    enabled: !!user,
    queryFn: () => db.getSettings(user!.uid),
  })
}
export function useUpdateSettings() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Settings>) => db.updateSettings(user!.uid, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}

// ---------- Dashboard ----------
export function useDashboard(month: number, year: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['dashboard', user?.uid, month, year],
    enabled: !!user,
    queryFn: () => getDashboard(user!.uid, month, year),
  })
}

// ---------- Accounts ----------
export function useAccounts() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['accounts', user?.uid], enabled: !!user, queryFn: () => db.getAccounts(user!.uid) })
}
export function useCreateAccount() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Account>) => db.createAccount(user!.uid, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Account> & { id: string }) => db.updateAccount(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteAccount(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}

// ---------- Categories ----------
export function useCategories() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['categories', user?.uid], enabled: !!user, queryFn: () => db.getCategories(user!.uid) })
}
export function useCreateCategory() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Category>) => db.createCategory(user!.uid, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['budget'] }) },
  })
}
export function useUpdateCategory() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Category> & { id: string }) => db.updateCategory(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['budget'] }) },
  })
}
export function useDeleteCategory() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteCategory(user!.uid, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['budget'] }) },
  })
}

// ---------- Income ----------
export function useIncomeSources() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['income', user?.uid], enabled: !!user, queryFn: () => db.getIncomeSources(user!.uid) })
}
export function useCreateIncome() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<IncomeSource>) => db.createIncome(user!.uid, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }),
  })
}
export function useUpdateIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<IncomeSource> & { id: string }) => db.updateIncome(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }),
  })
}
export function useDeleteIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteIncome(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }),
  })
}

// ---------- Transactions ----------
export function useTransactions(month?: number, year?: number) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['transactions', user?.uid, month, year], enabled: !!user, queryFn: () => db.getTransactions(user!.uid, month, year) })
}
export function useCreateTransaction() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => db.createTransaction(user!.uid, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['budget'] }); qc.invalidateQueries({ queryKey: ['accounts'] }) },
  })
}
export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Transaction> & { id: string }) => db.updateTransaction(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['budget'] }) },
  })
}
export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteTransaction(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['budget'] }); qc.invalidateQueries({ queryKey: ['accounts'] }) },
  })
}

// ---------- Budgets ----------
export function useBudget(month: number, year: number) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['budget', user?.uid, month, year], enabled: !!user, queryFn: () => getBudgetRows(user!.uid, month, year) })
}
export function useUpdateBudget() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { month: number; year: number; categoryId: string; planned: number }) =>
      db.upsertBudget(user!.uid, data.month, data.year, data.categoryId, data.planned),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}

// ---------- Savings Goals ----------
export function useSavingsGoals() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['savings-goals', user?.uid], enabled: !!user, queryFn: () => db.getSavingsGoals(user!.uid) })
}
export function useCreateSavingsGoal() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<SavingsGoal>) => db.createSavingsGoal(user!.uid, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['savings-goals'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useUpdateSavingsGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, addAmount, ...data }: Partial<SavingsGoal> & { id: string; addAmount?: number }) =>
      db.updateSavingsGoal(id, { ...data, addAmount }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['savings-goals'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useDeleteSavingsGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteSavingsGoal(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['savings-goals'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}

// ---------- Debts ----------
export function useDebts() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['debts', user?.uid], enabled: !!user, queryFn: () => db.getDebts(user!.uid) })
}
export function useCreateDebt() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Debt>) => db.createDebt(user!.uid, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useUpdateDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Debt> & { id: string }) => db.updateDebt(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useDeleteDebt() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteDebt(user!.uid, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useDebtPayment() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount, date, note }: { id: string; amount: number; date?: string; note?: string }) =>
      db.recordDebtPayment(user!.uid, id, amount, date, note),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}

// ---------- Bills ----------
export function useBills() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['bills', user?.uid], enabled: !!user, queryFn: () => db.getBills(user!.uid) })
}
export function useCreateBill() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Bill>) => db.createBill(user!.uid, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useUpdateBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Bill> & { id: string }) => db.updateBill(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useDeleteBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.deleteBill(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}

// ---------- Reports ----------
export function useReports(year: number) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['reports', user?.uid, year], enabled: !!user, queryFn: () => getReport(user!.uid, year) })
}

// ---------- Weekly Checkin ----------
export function useWeeklyCheckin() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['weekly-checkin', user?.uid], enabled: !!user, queryFn: () => db.getWeeklyCheckin(user!.uid) })
}
export function useUpdateWeeklyCheckin() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, boolean>) => db.updateWeeklyCheckin(user!.uid, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['weekly-checkin'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}

// ---------- Seed (now client-side) ----------
export function useSeed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { seedClient } = await import('./seed-client')
      await seedClient()
    },
    onSuccess: () => qc.invalidateQueries(),
  })
}

// ---------- Admin ----------
export function useAdminStats() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['admin-stats'], enabled: !!user && user.role === 'admin', queryFn: () => db.adminGetStats() })
}
export interface AdminUser { id: string; email: string; name: string; role: string; createdAt: string; bannedAt: string | null; isDemo?: boolean }
export function useAdminUsers() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['admin-users'], enabled: !!user && user.role === 'admin', queryFn: () => db.adminGetUsers() })
}
export function useAdminUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { id: string; action: 'promote' | 'demote' | 'ban' | 'unban' }) => db.adminUpdateUser(data.id, data.action),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }) },
  })
}
export function useAdminDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => db.adminDeleteUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }) },
  })
}
export function useAdminCreateUser() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; role?: 'user' | 'admin' }) => {
      const { adminCreateUser } = await import('./auth-client')
      return adminCreateUser(data.name, data.email, data.password, data.role === 'admin', user!.uid)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }) },
  })
}

// Re-export the auth hook for convenience
export { useAuth } from './auth-client'
export type { AppUser } from './auth-client'
