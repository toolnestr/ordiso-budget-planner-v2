// Formatting and helper utilities for the Budget Planner

export function formatCurrency(
  amount: number,
  currencySymbol: string = "$",
  opts: { compact?: boolean; sign?: boolean } = {}
): string {
  const { compact = false, sign = false } = opts;
  const abs = Math.abs(amount);
  let str: string;
  if (compact && abs >= 1000) {
    if (abs >= 1_000_000) {
      str = (abs / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    } else {
      str = (abs / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    }
  } else {
    str = abs.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  const prefix = amount < 0 ? "-" : sign ? "+" : "";
  return `${prefix}${currencySymbol}${str}`;
}

export function formatNumber(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function formatDate(date: Date | string, fmt: "short" | "medium" | "long" = "medium"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (fmt === "short") return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
  if (fmt === "long")
    return d.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function monthName(month: number): string {
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return names[month - 1] ?? "";
}

export function monthShort(month: number): string {
  return monthName(month).slice(0, 3);
}

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function daysUntil(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Color mapping for categories/accounts (Tailwind-friendly hex)
export const COLOR_MAP: Record<string, string> = {
  emerald: "#10b981",
  green: "#22c55e",
  teal: "#14b8a6",
  amber: "#f59e0b",
  orange: "#f97316",
  rose: "#f43f5e",
  red: "#ef4444",
  pink: "#ec4899",
  purple: "#a855f7",
  violet: "#8b5cf6",
  yellow: "#eab308",
  lime: "#84cc16",
  cyan: "#06b6d4",
  fuchsia: "#d946ef",
  slate: "#64748b",
};

export function colorHex(key: string): string {
  return COLOR_MAP[key] ?? COLOR_MAP.emerald;
}

export const COLOR_KEYS = Object.keys(COLOR_MAP);

export const CATEGORY_ICONS = [
  "🏠", "🍔", "🚗", "💡", "🎬", "🛒", "💊", "👶", "🐾", "✈️",
  "💳", "🎓", "👕", "📱", "💪", "🎁", "🔧", "🚌", "☕", "📚",
  "💰", "💵", "📈", "🎯", "🏖️", "🚗", "🎄", "💍", "🦷", "🩺",
];

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Auto-categorization rules — keyword -> category name
export const AUTO_CATEGORY_RULES: { keywords: string[]; category: string }[] = [
  { keywords: ["starbucks", "coffee", "cafe", "dunkin", "tim hortons"], category: "Dining Out" },
  { keywords: ["grocery", "walmart", "trader joe", "whole foods", "aldi", "kroger", "safeway", "costco"], category: "Groceries" },
  { keywords: ["uber", "lyft", "gas", "shell", "chevron", "exxon", "bp", "parking", "transit", "subway"], category: "Transport" },
  { keywords: ["netflix", "spotify", "hulu", "disney", "amazon prime", "youtube"], category: "Entertainment" },
  { keywords: ["rent", "mortgage", "landlord"], category: "Rent / Housing" },
  { keywords: ["electric", "water", "gas bill", "internet", "comcast", "verizon", "utility"], category: "Utilities" },
  { keywords: ["restaurant", "mcdonald", "chipotle", "doordash", "uber eats", "grubhub", "pizza"], category: "Dining Out" },
  { keywords: ["pharmacy", "cvs", "walgreens", "prescription", "doctor", "dentist", "hospital"], category: "Medical / Health" },
  { keywords: ["pet", "vet", "petco", "petsmart"], category: "Pets" },
  { keywords: ["salary", "payroll", "paycheck", "direct deposit"], category: "Primary Income" },
  { keywords: ["freelance", "client", "invoice", "contract"], category: "Side Hustle" },
];

export function guessCategory(description: string): string | null {
  const lower = description.toLowerCase();
  for (const rule of AUTO_CATEGORY_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.category;
  }
  return null;
}
