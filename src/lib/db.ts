'use client'

// Client-side Firestore data layer.
// Replaces all the server-side API routes — the browser talks to Firestore
// directly (secured by firestore.rules). This removes the need for Cloudflare
// Workers entirely; the app deploys as a static site.
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit as fbLimit, writeBatch, type QueryConstraint, type WhereFilterOp,
} from 'firebase/firestore'
import { db } from './firebase'
import { useAuth, isDemoUser } from './auth-client'
import type {
  Settings, Account, Category, IncomeSource, Transaction, SavingsGoal, Debt, DebtPayment, Bill, MonthlyBudget,
} from './types'

// Demo data is read-only. Every write function calls this guard first; if the
// signed-in user is the demo account, the write is rejected with a clear error
// before it reaches Firestore.
const DEMO_MSG = 'Demo data is read-only. Create your own account to start budgeting.'
function assertWritable() {
  if (isDemoUser()) throw new Error(DEMO_MSG)
}

type Doc<T> = T & { id: string }

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = obj[k]
  }
  return out
}

async function getAll<T>(name: string, userId: string, orderByField?: string): Promise<Doc<T>[]> {
  const q = orderByField
    ? query(collection(db, name), where('userId', '==', userId), orderBy(orderByField))
    : query(collection(db, name), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }))
}

async function getWhere<T>(name: string, userId: string, field: string, value: unknown): Promise<Doc<T>[]> {
  const q = query(collection(db, name), where('userId', '==', userId), where(field, '==', value))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }))
}

// ───────────────────────── Settings ─────────────────────────
const SETTINGS_DEFAULTS: Settings = {
  id: 'singleton', currencySymbol: '$', currencyCode: 'USD', cashEnvelopeMode: false,
  weeklyCheckinDay: 0, setupComplete: false, plannerName: 'Ordiso Planner',
}

export async function getSettings(userId: string): Promise<Settings> {
  const id = `singleton_${userId}`
  const snap = await getDoc(doc(db, 'settings', id))
  if (!snap.exists()) {
    await setDoc(doc(db, 'settings', id), { ...SETTINGS_DEFAULTS, userId })
    return { ...SETTINGS_DEFAULTS, id }
  }
  return { ...(snap.data() as Settings), id }
}

export async function updateSettings(userId: string, data: Partial<Settings>): Promise<void> {
  assertWritable()
  await setDoc(doc(db, 'settings', `singleton_${userId}`), { ...stripUndefined(data as Record<string, unknown>), userId }, { merge: true })
}

// ───────────────────────── Accounts ─────────────────────────
export async function getAccounts(userId: string): Promise<(Account & { currentBalance: number })[]> {
  const accounts = await getAll<Account>('accounts', userId, 'createdAt')
  const txs = await getAll<Transaction>('transactions', userId)
  const txByAccount = new Map<string, Transaction[]>()
  for (const t of txs) {
    if (!t.accountId) continue
    const arr = txByAccount.get(t.accountId) ?? []
    arr.push(t)
    txByAccount.set(t.accountId, arr)
  }
  return accounts.map((a) => {
    const atxs = txByAccount.get(a.id) ?? []
    const sum = atxs.reduce((acc, t) => acc + (t.type === 'INCOME' ? t.amount : t.type === 'EXPENSE' ? -t.amount : 0), 0)
    return { ...a, currentBalance: a.startingBalance + sum }
  })
}

export async function createAccount(userId: string, data: Partial<Account>): Promise<string> {
  assertWritable()
  const ref = await addDoc(collection(db, 'accounts'), {
    name: data.name, type: data.type ?? 'CHECKING',
    startingBalance: Number(data.startingBalance) || 0, color: data.color ?? 'emerald',
    userId, createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateAccount(id: string, data: Partial<Account>): Promise<void> {
  assertWritable()
  await updateDoc(doc(db, 'accounts', id), stripUndefined(data as Record<string, unknown>))
}

export async function deleteAccount(id: string): Promise<void> {
  assertWritable()
  await deleteDoc(doc(db, 'accounts', id))
}

// ───────────────────────── Categories ─────────────────────────
export async function getCategories(userId: string): Promise<Category[]> {
  const cats = await getAll<Omit<Category, 'id'> & { id: string }>('categories', userId)
  cats.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''))
  return cats
}

export async function createCategory(userId: string, data: Partial<Category>): Promise<string> {
  assertWritable()
  const existing = await getCategories(userId)
  const maxOrder = existing.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), 0)
  const ref = await addDoc(collection(db, 'categories'), {
    name: data.name, type: data.type ?? 'EXPENSE', group: data.group ?? 'VARIABLE',
    color: data.color ?? 'emerald', icon: data.icon ?? '📁', rollover: data.rollover ?? false,
    sortOrder: data.sortOrder ?? maxOrder + 1, isSystem: false, userId,
  })
  return ref.id
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<void> {
  assertWritable()
  await updateDoc(doc(db, 'categories', id), stripUndefined(data as Record<string, unknown>))
}

export async function deleteCategory(userId: string, id: string): Promise<void> {
  assertWritable()
  // Unlink transactions, delete budgets, then the category
  const txs = await getWhere<Transaction>('transactions', userId, 'categoryId', id)
  const batch = writeBatch(db)
  txs.forEach((t) => batch.update(doc(db, 'transactions', t.id), { categoryId: null }))
  await batch.commit()
  const budgets = await getWhere<MonthlyBudget>('monthlyBudgets', userId, 'categoryId', id)
  const batch2 = writeBatch(db)
  budgets.forEach((b) => batch2.delete(doc(db, 'monthlyBudgets', b.id)))
  await batch2.commit()
  await deleteDoc(doc(db, 'categories', id))
}

// ───────────────────────── Income Sources ─────────────────────────
export async function getIncomeSources(userId: string): Promise<IncomeSource[]> {
  return getAll<IncomeSource>('incomeSources', userId, 'sortOrder')
}

export async function createIncome(userId: string, data: Partial<IncomeSource>): Promise<string> {
  assertWritable()
  const existing = await getIncomeSources(userId)
  const maxOrder = existing.reduce((m, c) => Math.max(m, c.sortOrder ?? 0), 0)
  const ref = await addDoc(collection(db, 'incomeSources'), {
    name: data.name, type: data.type ?? 'PRIMARY', expectedMonthly: Number(data.expectedMonthly) || 0,
    isIrregular: data.isIrregular ?? false, notes: data.notes ?? null,
    sortOrder: data.sortOrder ?? maxOrder + 1, userId, createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateIncome(id: string, data: Partial<IncomeSource>): Promise<void> {
  assertWritable()
  await updateDoc(doc(db, 'incomeSources', id), stripUndefined(data as Record<string, unknown>))
}

export async function deleteIncome(id: string): Promise<void> {
  assertWritable()
  await deleteDoc(doc(db, 'incomeSources', id))
}

// ───────────────────────── Transactions ─────────────────────────
export async function getTransactions(userId: string, month?: number, year?: number): Promise<Transaction[]> {
  let txs = await getAll<Transaction>('transactions', userId)
  if (month && year) {
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 1)
    txs = txs.filter((t) => {
      const d = new Date(t.date)
      return d >= start && d < end
    })
  }
  txs.sort((a, b) => (b.date > a.date ? 1 : -1))
  // Join category + account
  const [cats, accounts] = await Promise.all([getCategories(userId), getAccounts(userId)])
  const catMap = new Map(cats.map((c) => [c.id, c]))
  const accMap = new Map(accounts.map((a) => [a.id, { id: a.id, name: a.name }]))
  return txs.map((t) => ({
    ...t,
    category: t.categoryId ? catMap.get(t.categoryId) ?? null : null,
    account: t.accountId ? accMap.get(t.accountId) ?? null : null,
  }))
}

export async function createTransaction(userId: string, body: Record<string, unknown>): Promise<string> {
  assertWritable()
  const dateIso = body.date ? new Date(body.date as string).toISOString() : new Date().toISOString()
  if (Array.isArray(body.splits) && body.splits.length > 0) {
    const total = (body.splits as { amount: number }[]).reduce((s, sp) => s + Number(sp.amount), 0)
    const parentRef = await addDoc(collection(db, 'transactions'), {
      date: dateIso, description: body.description, amount: total, type: body.type ?? 'EXPENSE',
      categoryId: null, accountId: body.accountId ?? null, notes: body.notes ?? null,
      isSplit: true, parentTransactionId: null, isReconciled: false,
      userId, createdAt: new Date().toISOString(),
    })
    for (const sp of body.splits as { categoryId?: string; amount: number; note?: string }[]) {
      await addDoc(collection(db, 'transactions'), {
        date: dateIso, description: body.description, amount: Number(sp.amount), type: body.type ?? 'EXPENSE',
        categoryId: sp.categoryId ?? null, accountId: body.accountId ?? null, notes: sp.note ?? null,
        isSplit: false, parentTransactionId: parentRef.id, isReconciled: false,
        userId, createdAt: new Date().toISOString(),
      })
    }
    return parentRef.id
  }
  const ref = await addDoc(collection(db, 'transactions'), {
    date: dateIso, description: body.description, amount: Number(body.amount), type: body.type ?? 'EXPENSE',
    categoryId: body.categoryId ?? null, accountId: body.accountId ?? null, notes: body.notes ?? null,
    isSplit: false, parentTransactionId: null, isReconciled: false,
    userId, createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateTransaction(id: string, data: Partial<Transaction>): Promise<void> {
  assertWritable()
  const update: Record<string, unknown> = { ...stripUndefined(data as Record<string, unknown>) }
  if (data.date) update.date = new Date(data.date).toISOString()
  await updateDoc(doc(db, 'transactions', id), update)
}

export async function deleteTransaction(id: string): Promise<void> {
  assertWritable()
  // Also delete child splits
  const q = query(collection(db, 'transactions'), where('parentTransactionId', '==', id))
  const snap = await getDocs(q)
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(db, 'transactions', id))
  await batch.commit()
}

// ───────────────────────── Budgets ─────────────────────────
function budgetId(userId: string, year: number, month: number, categoryId: string) {
  return `${userId}_${year}_${month}_${categoryId}`
}

export async function getBudgets(userId: string, month: number, year: number) {
  const all = await getAll<MonthlyBudget>('monthlyBudgets', userId)
  return all.filter((b) => b.year === year && b.month === month)
}

export async function upsertBudget(userId: string, month: number, year: number, categoryId: string, planned: number): Promise<void> {
  await setDoc(doc(db, 'monthlyBudgets', budgetId(userId, year, month, categoryId)), {
    userId, month, year, categoryId, planned: Number(planned) || 0,
  }, { merge: true })
}

// ───────────────────────── Savings Goals ─────────────────────────
export async function getSavingsGoals(userId: string): Promise<SavingsGoal[]> {
  return getAll<SavingsGoal>('savingsGoals', userId, 'sortOrder')
}

export async function createSavingsGoal(userId: string, data: Partial<SavingsGoal>): Promise<string> {
  assertWritable()
  const existing = await getSavingsGoals(userId)
  const maxOrder = existing.reduce((m, g) => Math.max(m, g.sortOrder ?? 0), 0)
  const ref = await addDoc(collection(db, 'savingsGoals'), {
    name: data.name, targetAmount: Number(data.targetAmount) || 0, savedAmount: Number(data.savedAmount) || 0,
    targetDate: data.targetDate ? new Date(data.targetDate).toISOString() : null,
    color: data.color ?? 'emerald', icon: data.icon ?? '🎯', sortOrder: data.sortOrder ?? maxOrder + 1,
    userId, createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateSavingsGoal(id: string, data: Partial<SavingsGoal> & { addAmount?: number }, current?: SavingsGoal): Promise<void> {
  assertWritable()
  if (data.addAmount != null && current) {
    await updateDoc(doc(db, 'savingsGoals', id), { savedAmount: (current.savedAmount ?? 0) + Number(data.addAmount) })
    return
  }
  const update: Record<string, unknown> = {}
  if (data.name !== undefined) update.name = data.name
  if (data.targetAmount !== undefined) update.targetAmount = Number(data.targetAmount)
  if (data.savedAmount !== undefined) update.savedAmount = Number(data.savedAmount)
  if (data.targetDate !== undefined) update.targetDate = data.targetDate ? new Date(data.targetDate).toISOString() : null
  if (data.color !== undefined) update.color = data.color
  if (data.icon !== undefined) update.icon = data.icon
  await updateDoc(doc(db, 'savingsGoals', id), update)
}

export async function deleteSavingsGoal(id: string): Promise<void> {
  assertWritable()
  await deleteDoc(doc(db, 'savingsGoals', id))
}

// ───────────────────────── Debts ─────────────────────────
export async function getDebts(userId: string): Promise<(Debt & { payments: DebtPayment[] })[]> {
  const debts = await getAll<Debt>('debts', userId, 'sortOrder')
  const payments = await getAll<DebtPayment>('debtPayments', userId)
  const byDebt = new Map<string, DebtPayment[]>()
  for (const p of payments) {
    const arr = byDebt.get(p.debtId) ?? []
    arr.push(p)
    byDebt.set(p.debtId, arr)
  }
  return debts.map((d) => ({
    ...d,
    payments: (byDebt.get(d.id) ?? []).sort((a, b) => (b.date > a.date ? 1 : -1)).slice(0, 6),
  }))
}

export async function createDebt(userId: string, data: Partial<Debt>): Promise<string> {
  assertWritable()
  const existing = await getDebts(userId)
  const maxOrder = existing.reduce((m, d) => Math.max(m, d.sortOrder ?? 0), 0)
  const ref = await addDoc(collection(db, 'debts'), {
    name: data.name, creditor: data.creditor ?? null,
    currentBalance: Number(data.currentBalance) || 0,
    originalBalance: Number(data.originalBalance ?? data.currentBalance) || 0,
    interestRate: Number(data.interestRate) || 0, minimumPayment: Number(data.minimumPayment) || 0,
    strategy: data.strategy ?? 'SNOWBALL', sortOrder: data.sortOrder ?? maxOrder + 1,
    paidOff: false, userId, createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateDebt(id: string, data: Partial<Debt>): Promise<void> {
  assertWritable()
  await updateDoc(doc(db, 'debts', id), stripUndefined(data as Record<string, unknown>))
}

export async function deleteDebt(userId: string, id: string): Promise<void> {
  assertWritable()
  const payments = await getWhere<DebtPayment>('debtPayments', userId, 'debtId', id)
  const batch = writeBatch(db)
  payments.forEach((p) => batch.delete(doc(db, 'debtPayments', p.id)))
  batch.delete(doc(db, 'debts', id))
  await batch.commit()
}

export async function recordDebtPayment(userId: string, debtId: string, amount: number, date?: string, note?: string): Promise<void> {
  assertWritable()
  await addDoc(collection(db, 'debtPayments'), {
    debtId, date: date ? new Date(date).toISOString() : new Date().toISOString(),
    amount: Number(amount), note: note ?? null, userId, createdAt: new Date().toISOString(),
  })
  const debtRef = doc(db, 'debts', debtId)
  const debtSnap = await getDoc(debtRef)
  const debt = debtSnap.data() as Debt
  let newBalance = (debt.currentBalance ?? 0) - amount
  let paidOff = false
  if (newBalance <= 0) { newBalance = 0; paidOff = true }
  await updateDoc(debtRef, { currentBalance: newBalance, paidOff })
}

// ───────────────────────── Bills ─────────────────────────
export async function getBills(userId: string): Promise<Bill[]> {
  const bills = await getAll<Bill>('bills', userId)
  bills.sort((a, b) => Number(b.active ?? true) - Number(a.active ?? true) || (a.name ?? '').localeCompare(b.name ?? ''))
  return bills
}

export async function createBill(userId: string, data: Partial<Bill>): Promise<string> {
  assertWritable()
  const ref = await addDoc(collection(db, 'bills'), {
    name: data.name, amount: Number(data.amount) || 0, frequency: data.frequency ?? 'MONTHLY',
    dueDay: Number(data.dueDay) || 1, category: data.category ?? null,
    isSubscription: data.isSubscription ?? false, cancelFlag: data.cancelFlag ?? false,
    active: data.active ?? true, lastPaidDate: data.lastPaidDate ? new Date(data.lastPaidDate).toISOString() : null,
    userId, createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateBill(id: string, data: Partial<Bill>): Promise<void> {
  assertWritable()
  const update: Record<string, unknown> = { ...stripUndefined(data as Record<string, unknown>) }
  if (data.lastPaidDate !== undefined) update.lastPaidDate = data.lastPaidDate ? new Date(data.lastPaidDate).toISOString() : null
  await updateDoc(doc(db, 'bills', id), update)
}

export async function deleteBill(id: string): Promise<void> {
  assertWritable()
  await deleteDoc(doc(db, 'bills', id))
}

// ───────────────────────── Weekly Checkin ─────────────────────────
export async function getWeeklyCheckin(userId: string) {
  const ws = new Date()
  ws.setDate(ws.getDate() - ws.getDay())
  ws.setHours(0, 0, 0, 0)
  const id = `${userId}_${ws.toISOString()}`
  const snap = await getDoc(doc(db, 'weeklyCheckins', id))
  if (!snap.exists()) {
    await setDoc(doc(db, 'weeklyCheckins', id), {
      userId, weekStart: ws.toISOString(), loggedReceipts: false, paidBills: false,
      reviewedBudget: false, reconciledAccounts: false, createdAt: new Date().toISOString(),
    })
    return { id, userId, weekStart: ws.toISOString(), loggedReceipts: false, paidBills: false, reviewedBudget: false, reconciledAccounts: false }
  }
  return { ...(snap.data() as Record<string, unknown>), id }
}

export async function updateWeeklyCheckin(userId: string, data: Record<string, boolean>) {
  assertWritable()
  const ws = new Date()
  ws.setDate(ws.getDate() - ws.getDay())
  ws.setHours(0, 0, 0, 0)
  const id = `${userId}_${ws.toISOString()}`
  await setDoc(doc(db, 'weeklyCheckins', id), { ...data, userId, weekStart: ws.toISOString() }, { merge: true })
}

// ───────────────────────── Admin ─────────────────────────
export async function adminGetUsers(): Promise<Array<{ id: string; name: string; email: string; role: string; createdAt: string; bannedAt?: string | null; isDemo?: boolean }>> {
  const snap = await getDocs(collection(db, 'users'))
  const users = snap.docs.map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id }) as { id: string; name: string; email: string; role: string; createdAt: string; bannedAt?: string | null; isDemo?: boolean })
  users.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  return users
}

export async function adminUpdateUser(id: string, action: 'promote' | 'demote' | 'ban' | 'unban') {
  assertWritable()
  if (action === 'promote') await updateDoc(doc(db, 'users', id), { role: 'admin', bannedAt: null })
  if (action === 'demote') await updateDoc(doc(db, 'users', id), { role: 'user' })
  if (action === 'ban') await updateDoc(doc(db, 'users', id), { bannedAt: new Date().toISOString() })
  if (action === 'unban') await updateDoc(doc(db, 'users', id), { bannedAt: null })
}

export async function adminDeleteUser(userId: string) {
  assertWritable()
  // Delete all the user's data across collections
  const collections = ['debtPayments', 'weeklyCheckins', 'bills', 'debts', 'savingsGoals', 'monthlyBudgets', 'transactions', 'incomeSources', 'categories', 'accounts', 'settings']
  for (const c of collections) {
    const q = query(collection(db, c), where('userId', '==', userId))
    const snap = await getDocs(q)
    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  await deleteDoc(doc(db, 'users', userId))
}

export async function adminGetStats() {
  const snap = await getDocs(collection(db, 'users'))
  const users = snap.docs.map((d) => d.data() as { role?: string; bannedAt?: string; createdAt?: string; isDemo?: boolean })
  return {
    totalUsers: users.length,
    bannedUsers: users.filter((u) => u.bannedAt).length,
    adminUsers: users.filter((u) => u.role === 'admin').length,
    newThisWeek: users.filter((u) => (u.createdAt ?? '') >= new Date(Date.now() - 7 * 86400000).toISOString()).length,
  }
}
