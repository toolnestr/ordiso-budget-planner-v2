'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TabId =
  | 'dashboard'
  | 'setup'
  | 'budget'
  | 'transactions'
  | 'savings'
  | 'debt'
  | 'reports'
  | 'bills'

interface BudgetStore {
  activeTab: TabId
  month: number
  year: number
  setActiveTab: (tab: TabId) => void
  setMonth: (month: number) => void
  setYear: (year: number) => void
  setMonthYear: (month: number, year: number) => void
  prevMonth: () => void
  nextMonth: () => void
}

const now = new Date()

export const useBudgetStore = create<BudgetStore>()(
  persist(
    (set, get) => ({
      activeTab: 'dashboard',
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setMonth: (month) => set({ month }),
      setYear: (year) => set({ year }),
      setMonthYear: (month, year) => set({ month, year }),
      prevMonth: () => {
        const { month, year } = get()
        if (month === 1) set({ month: 12, year: year - 1 })
        else set({ month: month - 1 })
      },
      nextMonth: () => {
        const { month, year } = get()
        if (month === 12) set({ month: 1, year: year + 1 })
        else set({ month: month + 1 })
      },
    }),
    { name: 'budget-store' }
  )
)
