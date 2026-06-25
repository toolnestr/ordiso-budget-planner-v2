// Shared TypeScript types for the Budget Planner

export type AccountType = "CHECKING" | "SAVINGS" | "CREDIT" | "CASH";
export type CategoryType = "INCOME" | "EXPENSE";
export type CategoryGroup = "FIXED" | "VARIABLE" | "SAVING" | "DEBT";
export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";
export type IncomeType = "PRIMARY" | "SIDE" | "PASSIVE";
export type DebtStrategy = "SNOWBALL" | "AVALANCHE" | "CUSTOM";
export type BillFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "BIANNUAL" | "ANNUAL";

export interface Settings {
  id: string;
  currencySymbol: string;
  currencyCode: string;
  cashEnvelopeMode: boolean;
  weeklyCheckinDay: number;
  setupComplete: boolean;
  plannerName: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  startingBalance: number;
  color: string;
  currentBalance?: number;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  group: CategoryGroup;
  color: string;
  icon: string;
  rollover: boolean;
  sortOrder: number;
  isSystem: boolean;
}

export interface IncomeSource {
  id: string;
  name: string;
  type: IncomeType;
  expectedMonthly: number;
  isIrregular: boolean;
  notes: string | null;
  sortOrder: number;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: string | null;
  account: { id: string; name: string } | null;
  accountId: string | null;
  category: { id: string; name: string; color: string; icon: string } | null;
  notes: string | null;
  isSplit: boolean;
  parentTransactionId: string | null;
  isReconciled: boolean;
}

export interface MonthlyBudget {
  id: string;
  month: number;
  year: number;
  categoryId: string;
  planned: number;
  category: Category;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: string | null;
  color: string;
  icon: string;
  sortOrder: number;
}

export interface Debt {
  id: string;
  name: string;
  creditor: string | null;
  currentBalance: number;
  originalBalance: number;
  interestRate: number;
  minimumPayment: number;
  strategy: DebtStrategy;
  sortOrder: number;
  paidOff: boolean;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  frequency: BillFrequency;
  dueDay: number;
  category: string | null;
  isSubscription: boolean;
  cancelFlag: boolean;
  lastPaidDate: string | null;
  active: boolean;
}

// Aggregated dashboard data
export interface DashboardData {
  settings: Settings;
  month: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  leftToSpend: number;
  plannedSavings: number;
  plannedExpenses: number;
  plannedIncome: number;
  accounts: (Account & { currentBalance: number })[];
  netWorth: number;
  expenseByCategory: { categoryId: string; name: string; color: string; icon: string; amount: number; budget: number }[];
  incomeVsExpenseTrend: { month: string; income: number; expenses: number; savings: number }[];
  savingsGoals: (SavingsGoal & { progress: number; remaining: number; monthlyContribution: number })[];
  debts: (Debt & { progress: number; payoffMonths: number | null; totalInterest: number | null })[];
  billsDueSoon: (Bill & { dueInDays: number; nextDueDate: string })[];
  overbudgetCategories: { name: string; color: string; budget: number; spent: number }[];
  topSpendingCategories: { name: string; color: string; icon: string; amount: number }[];
  weeklyCheckin: { id: string | null; loggedReceipts: boolean; paidBills: boolean; reviewedBudget: boolean; reconciledAccounts: boolean };
}

export interface MonthlyBudgetRow {
  category: Category;
  planned: number;
  actual: number;
  remaining: number;
  rolloverIn: number;
  progress: number;
}

export interface AnnualReportData {
  year: number;
  monthlyTrend: { month: string; monthNum: number; income: number; expenses: number; savings: number; netWorth: number }[];
  categoryHeatmap: { category: string; color: string; icon: string; months: number[] }[];
  yearEnd: { totalIncome: number; totalExpenses: number; totalSaved: number; avgMonthlySpending: number; bestMonth: string; worstMonth: string };
  topCategories: { name: string; color: string; icon: string; amount: number; percent: number }[];
}
