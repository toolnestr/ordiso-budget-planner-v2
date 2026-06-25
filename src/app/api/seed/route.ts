import { db } from '@/lib/db'
import { ok, err } from '@/lib/api'
import { monthName } from '@/lib/format'

export const dynamic = 'force-dynamic'

// Comprehensive seed data — creates a realistic budget scenario across ~6 months
export async function POST() {
  try {
    // Wipe existing data (order matters for FK constraints)
    await db.debtPayment.deleteMany()
    await db.weeklyCheckin.deleteMany()
    await db.bill.deleteMany()
    await db.debt.deleteMany()
    await db.savingsGoal.deleteMany()
    await db.monthlyBudget.deleteMany()
    await db.transaction.deleteMany()
    await db.incomeSource.deleteMany()
    await db.category.deleteMany()
    await db.account.deleteMany()
    await db.settings.deleteMany()

    const now = new Date()
    const curMonth = now.getMonth() + 1
    const curYear = now.getFullYear()

    // Settings
    await db.settings.create({
      data: {
        id: 'singleton',
        currencySymbol: '$',
        currencyCode: 'USD',
        cashEnvelopeMode: false,
        weeklyCheckinDay: 0,
        setupComplete: true,
        plannerName: 'FinFlow Planner',
      },
    })

    // Accounts
    const accounts = await db.account.createManyAndReturn({
      data: [
        { name: 'Everyday Checking', type: 'CHECKING', startingBalance: 2400, color: 'emerald' },
        { name: 'High-Yield Savings', type: 'SAVINGS', startingBalance: 5200, color: 'teal' },
        { name: 'Rewards Credit Card', type: 'CREDIT', startingBalance: -850, color: 'rose' },
        { name: 'Cash Wallet', type: 'CASH', startingBalance: 80, color: 'amber' },
      ],
    })
    const aMap = Object.fromEntries(accounts.map((a) => [a.name, a.id]))

    // Categories
    const catDefs: { name: string; type: string; group: string; color: string; icon: string; rollover?: boolean; sortOrder: number }[] = [
      { name: 'Primary Income', type: 'INCOME', group: 'FIXED', color: 'emerald', icon: '💰', sortOrder: 0 },
      { name: 'Side Hustle', type: 'INCOME', group: 'VARIABLE', color: 'teal', icon: '💼', sortOrder: 1 },
      { name: 'Freelance', type: 'INCOME', group: 'VARIABLE', color: 'cyan', icon: '💻', sortOrder: 2 },

      { name: 'Rent / Housing', type: 'EXPENSE', group: 'FIXED', color: 'slate', icon: '🏠', sortOrder: 10 },
      { name: 'Utilities', type: 'EXPENSE', group: 'FIXED', color: 'amber', icon: '💡', sortOrder: 11 },
      { name: 'Internet', type: 'EXPENSE', group: 'FIXED', color: 'cyan', icon: '📶', sortOrder: 12 },
      { name: 'Car Insurance', type: 'EXPENSE', group: 'FIXED', color: 'violet', icon: '🚗', sortOrder: 13 },
      { name: 'Phone Bill', type: 'EXPENSE', group: 'FIXED', color: 'purple', icon: '📱', sortOrder: 14 },

      { name: 'Groceries', type: 'EXPENSE', group: 'VARIABLE', color: 'green', icon: '🛒', rollover: true, sortOrder: 20 },
      { name: 'Dining Out', type: 'EXPENSE', group: 'VARIABLE', color: 'orange', icon: '🍔', rollover: true, sortOrder: 21 },
      { name: 'Transport', type: 'EXPENSE', group: 'VARIABLE', color: 'blue', icon: '⛽', rollover: false, sortOrder: 22 },
      { name: 'Entertainment', type: 'EXPENSE', group: 'VARIABLE', color: 'fuchsia', icon: '🎬', rollover: false, sortOrder: 23 },
      { name: 'Shopping', type: 'EXPENSE', group: 'VARIABLE', color: 'pink', icon: '🛍️', rollover: false, sortOrder: 24 },
      { name: 'Medical / Health', type: 'EXPENSE', group: 'VARIABLE', color: 'red', icon: '🩺', rollover: false, sortOrder: 25 },
      { name: 'Pets', type: 'EXPENSE', group: 'VARIABLE', color: 'amber', icon: '🐾', rollover: false, sortOrder: 26 },
      { name: 'Childcare', type: 'EXPENSE', group: 'VARIABLE', color: 'rose', icon: '👶', rollover: false, sortOrder: 27 },
      { name: 'Personal Care', type: 'EXPENSE', group: 'VARIABLE', color: 'teal', icon: '💇', rollover: false, sortOrder: 28 },
      { name: 'Education', type: 'EXPENSE', group: 'VARIABLE', color: 'violet', icon: '📚', rollover: false, sortOrder: 29 },

      { name: 'Emergency Fund', type: 'EXPENSE', group: 'SAVING', color: 'emerald', icon: '🛟', sortOrder: 40 },
      { name: 'Vacation Fund', type: 'EXPENSE', group: 'SAVING', color: 'cyan', icon: '🏖️', sortOrder: 41 },
      { name: 'Christmas Gifts', type: 'EXPENSE', group: 'SAVING', color: 'red', icon: '🎄', sortOrder: 42 },
      { name: 'New Car Fund', type: 'EXPENSE', group: 'SAVING', color: 'slate', icon: '🚙', sortOrder: 43 },

      { name: 'Credit Card Debt', type: 'EXPENSE', group: 'DEBT', color: 'rose', icon: '💳', sortOrder: 50 },
      { name: 'Student Loan', type: 'EXPENSE', group: 'DEBT', color: 'purple', icon: '🎓', sortOrder: 51 },
      { name: 'Car Loan', type: 'EXPENSE', group: 'DEBT', color: 'blue', icon: '🚗', sortOrder: 52 },
    ]
    const cats = await db.category.createManyAndReturn({
      data: catDefs.map((c) => ({ ...c, isSystem: true })),
    })
    const cMap = Object.fromEntries(cats.map((c) => [c.name, c.id]))

    // Income sources
    await db.incomeSource.createMany({
      data: [
        { name: 'Day Job Salary', type: 'PRIMARY', expectedMonthly: 4500, isIrregular: false, sortOrder: 0 },
        { name: 'Freelance Design', type: 'SIDE', expectedMonthly: 800, isIrregular: true, notes: 'Varies month to month', sortOrder: 1 },
        { name: 'Dividend Income', type: 'PASSIVE', expectedMonthly: 120, isIrregular: false, sortOrder: 2 },
      ],
    })

    // Savings goals
    await db.savingsGoal.createMany({
      data: [
        { name: 'Emergency Fund', targetAmount: 15000, savedAmount: 8200, color: 'emerald', icon: '🛟', sortOrder: 0, targetDate: new Date(curYear + 1, 5, 1) },
        { name: 'Summer Vacation', targetAmount: 4000, savedAmount: 2600, color: 'cyan', icon: '🏖️', sortOrder: 1, targetDate: new Date(curYear, 6, 15) },
        { name: 'Christmas Gifts', targetAmount: 1200, savedAmount: 480, color: 'red', icon: '🎄', sortOrder: 2, targetDate: new Date(curYear, 11, 1) },
        { name: 'New Car Down Payment', targetAmount: 8000, savedAmount: 1900, color: 'slate', icon: '🚙', sortOrder: 3, targetDate: new Date(curYear + 1, 11, 1) },
      ],
    })

    // Debts
    const debts = await db.debt.createManyAndReturn({
      data: [
        { name: 'Visa Rewards Card', creditor: 'Chase', currentBalance: 1850, originalBalance: 3200, interestRate: 22.9, minimumPayment: 75, strategy: 'AVALANCHE', sortOrder: 0 },
        { name: 'Sallie Mae Student Loan', creditor: 'Sallie Mae', currentBalance: 12500, originalBalance: 22000, interestRate: 5.5, minimumPayment: 180, strategy: 'AVALANCHE', sortOrder: 1 },
        { name: 'Auto Loan', creditor: 'Toyota Financial', currentBalance: 8000, originalBalance: 18000, interestRate: 4.2, minimumPayment: 320, strategy: 'AVALANCHE', sortOrder: 2 },
      ],
    })
    // Some debt payments history
    for (const d of debts) {
      const payments = []
      for (let m = 5; m >= 0; m--) {
        const date = new Date(curYear, curMonth - 1 - m, 15)
        payments.push({ debtId: d.id, date, amount: d.minimumPayment, note: 'Minimum payment' })
      }
      await db.debtPayment.createMany({ data: payments })
    }

    // Bills & subscriptions
    await db.bill.createMany({
      data: [
        { name: 'Rent', amount: 1450, frequency: 'MONTHLY', dueDay: 1, category: 'Rent / Housing', isSubscription: false, active: true, lastPaidDate: new Date(curYear, curMonth - 1, 1) },
        { name: 'Electric & Gas', amount: 140, frequency: 'MONTHLY', dueDay: 18, category: 'Utilities', isSubscription: false, active: true, lastPaidDate: new Date(curYear, curMonth - 2, 18) },
        { name: 'Internet', amount: 65, frequency: 'MONTHLY', dueDay: 5, category: 'Internet', isSubscription: false, active: true, lastPaidDate: new Date(curYear, curMonth - 1, 5) },
        { name: 'Phone Plan', amount: 55, frequency: 'MONTHLY', dueDay: 22, category: 'Phone Bill', isSubscription: false, active: true },
        { name: 'Netflix', amount: 15.49, frequency: 'MONTHLY', dueDay: 12, category: 'Entertainment', isSubscription: true, cancelFlag: false, active: true },
        { name: 'Spotify Family', amount: 16.99, frequency: 'MONTHLY', dueDay: 9, category: 'Entertainment', isSubscription: true, cancelFlag: false, active: true },
        { name: 'Gym Membership', amount: 39.99, frequency: 'MONTHLY', dueDay: 3, category: 'Personal Care', isSubscription: true, cancelFlag: true, active: true },
        { name: 'Cloud Storage', amount: 9.99, frequency: 'MONTHLY', dueDay: 14, category: 'Internet', isSubscription: true, cancelFlag: false, active: true },
        { name: 'Amazon Prime', amount: 139, frequency: 'ANNUAL', dueDay: 20, category: 'Shopping', isSubscription: true, cancelFlag: false, active: true },
        { name: 'Car Insurance', amount: 780, frequency: 'BIANNUAL', dueDay: 10, category: 'Car Insurance', isSubscription: false, active: true },
        { name: 'Software Subscription', amount: 24, frequency: 'MONTHLY', dueDay: 25, category: 'Internet', isSubscription: true, cancelFlag: true, active: true },
      ],
    })

    // Generate transactions across 6 months (current + 5 prior) for trend charts
    const txData: { date: Date; description: string; amount: number; type: string; categoryId: string; accountId: string; notes?: string }[] = []
    for (let m = 5; m >= 0; m--) {
      const monthDate = new Date(curYear, curMonth - 1 - m, 1)
      const my = monthDate.getFullYear()
      const mm = monthDate.getMonth() + 1
      const dim = new Date(my, mm, 0).getDate()

      // Income — salary on 1st & 15th
      txData.push({ date: new Date(my, mm - 1, 1), description: 'Salary Deposit', amount: 2250, type: 'INCOME', categoryId: cMap['Primary Income'], accountId: aMap['Everyday Checking'] })
      txData.push({ date: new Date(my, mm - 1, 15), description: 'Salary Deposit', amount: 2250, type: 'INCOME', categoryId: cMap['Primary Income'], accountId: aMap['Everyday Checking'] })

      // Freelance (irregular)
      if (m % 2 === 0) {
        txData.push({ date: new Date(my, mm - 1, 20), description: 'Freelance — Logo Design', amount: 450 + m * 50, type: 'INCOME', categoryId: cMap['Freelance'], accountId: aMap['Everyday Checking'] })
      }
      if (m === 1 || m === 4) {
        txData.push({ date: new Date(my, mm - 1, 22), description: 'Freelance — Website', amount: 900, type: 'INCOME', categoryId: cMap['Freelance'], accountId: aMap['Everyday Checking'] })
      }
      // Dividends
      txData.push({ date: new Date(my, mm - 1, 28), description: 'Dividend Payout', amount: 120, type: 'INCOME', categoryId: cMap['Freelance'], accountId: aMap['High-Yield Savings'] })

      // Fixed expenses
      txData.push({ date: new Date(my, mm - 1, 1), description: 'Rent Payment', amount: 1450, type: 'EXPENSE', categoryId: cMap['Rent / Housing'], accountId: aMap['Everyday Checking'] })
      txData.push({ date: new Date(my, mm - 1, 18), description: 'Electric & Gas', amount: 120 + Math.round(Math.random() * 40), type: 'EXPENSE', categoryId: cMap['Utilities'], accountId: aMap['Everyday Checking'] })
      txData.push({ date: new Date(my, mm - 1, 5), description: 'Internet Bill', amount: 65, type: 'EXPENSE', categoryId: cMap['Internet'], accountId: aMap['Everyday Checking'] })
      txData.push({ date: new Date(my, mm - 1, 22), description: 'Phone Bill', amount: 55, type: 'EXPENSE', categoryId: cMap['Phone Bill'], accountId: aMap['Everyday Checking'] })

      // Subscriptions
      txData.push({ date: new Date(my, mm - 1, 12), description: 'Netflix', amount: 15.49, type: 'EXPENSE', categoryId: cMap['Entertainment'], accountId: aMap['Rewards Credit Card'] })
      txData.push({ date: new Date(my, mm - 1, 9), description: 'Spotify', amount: 16.99, type: 'EXPENSE', categoryId: cMap['Entertainment'], accountId: aMap['Rewards Credit Card'] })
      txData.push({ date: new Date(my, mm - 1, 3), description: 'Gym Membership', amount: 39.99, type: 'EXPENSE', categoryId: cMap['Personal Care'], accountId: aMap['Everyday Checking'] })

      // Variable expenses — several per month
      const groceryRuns = 4 + Math.floor(Math.random() * 2)
      for (let g = 0; g < groceryRuns; g++) {
        const day = Math.min(dim, 3 + g * 7 + Math.floor(Math.random() * 3))
        txData.push({ date: new Date(my, mm - 1, day), description: ['Whole Foods', 'Trader Joes', 'Costco', 'Local Market'][g % 4], amount: 60 + Math.round(Math.random() * 90), type: 'EXPENSE', categoryId: cMap['Groceries'], accountId: aMap['Rewards Credit Card'] })
      }
      // Dining out
      const eats = 3 + Math.floor(Math.random() * 3)
      for (let e = 0; e < eats; e++) {
        const day = Math.min(dim, 2 + e * 9 + Math.floor(Math.random() * 4))
        txData.push({ date: new Date(my, mm - 1, day), description: ['Starbucks', 'Chipotle', 'Local Bistro', 'DoorDash', 'Pizza Place'][e % 5], amount: 12 + Math.round(Math.random() * 45), type: 'EXPENSE', categoryId: cMap['Dining Out'], accountId: aMap['Rewards Credit Card'] })
      }
      // Transport
      txData.push({ date: new Date(my, mm - 1, 10), description: 'Shell Gas', amount: 45 + Math.round(Math.random() * 25), type: 'EXPENSE', categoryId: cMap['Transport'], accountId: aMap['Everyday Checking'] })
      txData.push({ date: new Date(my, mm - 1, 24), description: 'Shell Gas', amount: 45 + Math.round(Math.random() * 25), type: 'EXPENSE', categoryId: cMap['Transport'], accountId: aMap['Everyday Checking'] })
      // Shopping
      if (m === 0 || m === 2) {
        txData.push({ date: new Date(my, mm - 1, 14), description: 'Target Run', amount: 80 + Math.round(Math.random() * 60), type: 'EXPENSE', categoryId: cMap['Shopping'], accountId: aMap['Rewards Credit Card'] })
      }
      // Entertainment
      txData.push({ date: new Date(my, mm - 1, 16), description: 'Movie Tickets', amount: 28, type: 'EXPENSE', categoryId: cMap['Entertainment'], accountId: aMap['Everyday Checking'] })
      // Medical (occasional)
      if (m === 1 || m === 4) {
        txData.push({ date: new Date(my, mm - 1, 12), description: 'Pharmacy — Prescription', amount: 35, type: 'EXPENSE', categoryId: cMap['Medical / Health'], accountId: aMap['Everyday Checking'] })
      }
      // Pets
      txData.push({ date: new Date(my, mm - 1, 8), description: 'Pet Food & Supplies', amount: 55, type: 'EXPENSE', categoryId: cMap['Pets'], accountId: aMap['Rewards Credit Card'] })
      // Personal care
      txData.push({ date: new Date(my, mm - 1, 19), description: 'Haircut', amount: 35, type: 'EXPENSE', categoryId: cMap['Personal Care'], accountId: aMap['Everyday Checking'] })
      // Savings allocations (transfer to savings)
      txData.push({ date: new Date(my, mm - 1, 2), description: 'Emergency Fund Contribution', amount: 400, type: 'EXPENSE', categoryId: cMap['Emergency Fund'], accountId: aMap['High-Yield Savings'] })
      txData.push({ date: new Date(my, mm - 1, 2), description: 'Vacation Fund Contribution', amount: 200, type: 'EXPENSE', categoryId: cMap['Vacation Fund'], accountId: aMap['High-Yield Savings'] })
      txData.push({ date: new Date(my, mm - 1, 2), description: 'Christmas Fund Contribution', amount: 100, type: 'EXPENSE', categoryId: cMap['Christmas Gifts'], accountId: aMap['High-Yield Savings'] })
      // Debt payments
      txData.push({ date: new Date(my, mm - 1, 15), description: 'Visa Card Payment', amount: 250, type: 'EXPENSE', categoryId: cMap['Credit Card Debt'], accountId: aMap['Everyday Checking'] })
      txData.push({ date: new Date(my, mm - 1, 15), description: 'Student Loan Payment', amount: 180, type: 'EXPENSE', categoryId: cMap['Student Loan'], accountId: aMap['Everyday Checking'] })
      txData.push({ date: new Date(my, mm - 1, 15), description: 'Auto Loan Payment', amount: 320, type: 'EXPENSE', categoryId: cMap['Car Loan'], accountId: aMap['Everyday Checking'] })
    }

    await db.transaction.createMany({ data: txData })

    // Monthly budgets for current month
    const budgetPlan: Record<string, number> = {
      'Rent / Housing': 1450,
      'Utilities': 160,
      'Internet': 65,
      'Phone Bill': 55,
      'Car Insurance': 0, // biannual
      'Groceries': 450,
      'Dining Out': 200,
      'Transport': 120,
      'Entertainment': 80,
      'Shopping': 120,
      'Medical / Health': 50,
      'Pets': 60,
      'Personal Care': 60,
      'Emergency Fund': 400,
      'Vacation Fund': 200,
      'Christmas Gifts': 100,
      'Credit Card Debt': 250,
      'Student Loan': 180,
      'Car Loan': 320,
    }
    const budgetRows = Object.entries(budgetPlan).map(([name, planned]) => ({
      month: curMonth,
      year: curYear,
      categoryId: cMap[name],
      planned,
    }))
    await db.monthlyBudget.createMany({ data: budgetRows })

    return ok({ success: true, message: `Seeded ${monthName(curMonth)} ${curYear} data with 6 months of history.` })
  } catch (e) {
    return err(`Seed failed: ${(e as Error).message}`, 500)
  }
}

export async function GET() {
  const count = await db.transaction.count()
  return ok({ seeded: count > 0, transactionCount: count })
}
