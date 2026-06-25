'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  Settings, Account, Category, IncomeSource, Transaction, SavingsGoal, Debt, Bill,
  DashboardData, MonthlyBudgetRow, AnnualReportData,
} from '@/lib/types'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Request failed')
  }
  return res.json()
}

// ---------- Settings ----------
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => fetchJson<Settings>('/api/settings'),
  })
}
export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Settings>) => fetchJson('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}

// ---------- Dashboard ----------
export function useDashboard(month: number, year: number) {
  return useQuery({
    queryKey: ['dashboard', month, year],
    queryFn: () => fetchJson<DashboardData>(`/api/dashboard?month=${month}&year=${year}`),
  })
}

// ---------- Accounts ----------
export function useAccounts() {
  return useQuery({ queryKey: ['accounts'], queryFn: () => fetchJson<Account[]>('/api/accounts') })
}
export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Account>) => fetchJson('/api/accounts', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Account> & { id: string }) => fetchJson(`/api/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}

// ---------- Categories ----------
export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: () => fetchJson<Category[]>('/api/categories') })
}
export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Category>) => fetchJson('/api/categories', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); qc.invalidateQueries({ queryKey: ['budget'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Category> & { id: string }) => fetchJson(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); qc.invalidateQueries({ queryKey: ['budget'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); qc.invalidateQueries({ queryKey: ['budget'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}

// ---------- Income ----------
export function useIncomeSources() {
  return useQuery({ queryKey: ['income'], queryFn: () => fetchJson<IncomeSource[]>('/api/income') })
}
export function useCreateIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<IncomeSource>) => fetchJson('/api/income', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }),
  })
}
export function useUpdateIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<IncomeSource> & { id: string }) => fetchJson(`/api/income/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }),
  })
}
export function useDeleteIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/income/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }),
  })
}

// ---------- Transactions ----------
export function useTransactions(month?: number, year?: number) {
  const qs = month && year ? `?month=${month}&year=${year}` : ''
  return useQuery({ queryKey: ['transactions', month, year], queryFn: () => fetchJson<Transaction[]>(`/api/transactions${qs}`) })
}
export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => fetchJson('/api/transactions', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['budget'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}
export function useUpdateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) => fetchJson(`/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['budget'] })
    },
  })
}
export function useDeleteTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['budget'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

// ---------- Budgets ----------
export function useBudget(month: number, year: number) {
  return useQuery({
    queryKey: ['budget', month, year],
    queryFn: () => fetchJson<{ rows: MonthlyBudgetRow[]; summary: Record<string, number> }>(`/api/budgets?month=${month}&year=${year}`),
  })
}
export function useUpdateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { month: number; year: number; categoryId: string; planned: number }) =>
      fetchJson('/api/budgets', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}

// ---------- Savings Goals ----------
export function useSavingsGoals() {
  return useQuery({ queryKey: ['savings-goals'], queryFn: () => fetchJson<SavingsGoal[]>('/api/savings-goals') })
}
export function useCreateSavingsGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<SavingsGoal>) => fetchJson('/api/savings-goals', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['savings-goals'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useUpdateSavingsGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<SavingsGoal> & { id: string }) => fetchJson(`/api/savings-goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['savings-goals'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useDeleteSavingsGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/savings-goals/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['savings-goals'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}

// ---------- Debts ----------
export function useDebts() {
  return useQuery({ queryKey: ['debts'], queryFn: () => fetchJson<Debt[]>('/api/debts') })
}
export function useCreateDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Debt>) => fetchJson('/api/debts', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useUpdateDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Debt> & { id: string }) => fetchJson(`/api/debts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useDeleteDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/debts/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useDebtPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount, date, note }: { id: string; amount: number; date?: string; note?: string }) =>
      fetchJson(`/api/debts/${id}/payment`, { method: 'POST', body: JSON.stringify({ amount, date, note }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['debts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}

// ---------- Bills ----------
export function useBills() {
  return useQuery({ queryKey: ['bills'], queryFn: () => fetchJson<Bill[]>('/api/bills') })
}
export function useCreateBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Bill>) => fetchJson('/api/bills', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useUpdateBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Bill> & { id: string }) => fetchJson(`/api/bills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
export function useDeleteBill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/bills/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}

// ---------- Reports ----------
export function useReports(year: number) {
  return useQuery({ queryKey: ['reports', year], queryFn: () => fetchJson<AnnualReportData>(`/api/reports?year=${year}`) })
}

// ---------- Seed ----------
export function useSeed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => fetchJson('/api/seed', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries(),
  })
}

// ---------- Weekly Checkin ----------
export function useWeeklyCheckin() {
  return useQuery({ queryKey: ['weekly-checkin'], queryFn: () => fetchJson<{ id: string; loggedReceipts: boolean; paidBills: boolean; reviewedBudget: boolean; reconciledAccounts: boolean }>('/api/weekly-checkin') })
}
export function useUpdateWeeklyCheckin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, boolean>) => fetchJson('/api/weekly-checkin', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['weekly-checkin'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
  })
}
