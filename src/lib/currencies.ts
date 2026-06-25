// Comprehensive currency list — symbol, code, country/region name.
// Used by the Setup tab currency dropdowns. Selecting a currency auto-fills
// both the symbol and the ISO code. An "Other" option lets users enter a
// custom symbol/code for currencies not in the list.

export interface CurrencyOption {
  symbol: string
  code: string
  country: string
  label: string // "country — code (symbol)"
}

export const CURRENCIES: CurrencyOption[] = [
  { symbol: '$', code: 'USD', country: 'United States', label: 'United States — USD ($)' },
  { symbol: '€', code: 'EUR', country: 'Eurozone', label: 'Eurozone — EUR (€)' },
  { symbol: '£', code: 'GBP', country: 'United Kingdom', label: 'United Kingdom — GBP (£)' },
  { symbol: '¥', code: 'JPY', country: 'Japan', label: 'Japan — JPY (¥)' },
  { symbol: '₹', code: 'INR', country: 'India', label: 'India — INR (₹)' },
  { symbol: '₩', code: 'KRW', country: 'South Korea', label: 'South Korea — KRW (₩)' },
  { symbol: '₽', code: 'RUB', country: 'Russia', label: 'Russia — RUB (₽)' },
  { symbol: 'R$', code: 'BRL', country: 'Brazil', label: 'Brazil — BRL (R$)' },
  { symbol: 'C$', code: 'CAD', country: 'Canada', label: 'Canada — CAD (C$)' },
  { symbol: 'A$', code: 'AUD', country: 'Australia', label: 'Australia — AUD (A$)' },
  { symbol: 'CHF', code: 'CHF', country: 'Switzerland', label: 'Switzerland — CHF' },
  { symbol: '¥', code: 'CNY', country: 'China', label: 'China — CNY (¥)' },
  { symbol: 'kr', code: 'SEK', country: 'Sweden', label: 'Sweden — SEK (kr)' },
  { symbol: 'kr', code: 'NOK', country: 'Norway', label: 'Norway — NOK (kr)' },
  { symbol: 'kr', code: 'DKK', country: 'Denmark', label: 'Denmark — DKK (kr)' },
  { symbol: 'zł', code: 'PLN', country: 'Poland', label: 'Poland — PLN (zł)' },
  { symbol: 'Kč', code: 'CZK', country: 'Czech Republic', label: 'Czech Republic — CZK (Kč)' },
  { symbol: 'Ft', code: 'HUF', country: 'Hungary', label: 'Hungary — HUF (Ft)' },
  { symbol: '₺', code: 'TRY', country: 'Turkey', label: 'Turkey — TRY (₺)' },
  { symbol: '₴', code: 'UAH', country: 'Ukraine', label: 'Ukraine — UAH (₴)' },
  { symbol: '฿', code: 'THB', country: 'Thailand', label: 'Thailand — THB (฿)' },
  { symbol: '₱', code: 'PHP', country: 'Philippines', label: 'Philippines — PHP (₱)' },
  { symbol: 'RM', code: 'MYR', country: 'Malaysia', label: 'Malaysia — MYR (RM)' },
  { symbol: 'S$', code: 'SGD', country: 'Singapore', label: 'Singapore — SGD (S$)' },
  { symbol: 'Rp', code: 'IDR', country: 'Indonesia', label: 'Indonesia — IDR (Rp)' },
  { symbol: '₨', code: 'PKR', country: 'Pakistan', label: 'Pakistan — PKR (₨)' },
  { symbol: '৳', code: 'BDT', country: 'Bangladesh', label: 'Bangladesh — BDT (৳)' },
  { symbol: '﷼', code: 'SAR', country: 'Saudi Arabia', label: 'Saudi Arabia — SAR (﷼)' },
  { symbol: '﷼', code: 'AED', country: 'United Arab Emirates', label: 'UAE — AED (﷼)' },
  { symbol: '₪', code: 'ILS', country: 'Israel', label: 'Israel — ILS (₪)' },
  { symbol: 'R', code: 'ZAR', country: 'South Africa', label: 'South Africa — ZAR (R)' },
  { symbol: 'EGP', code: 'EGP', country: 'Egypt', label: 'Egypt — EGP' },
  { symbol: '₦', code: 'NGN', country: 'Nigeria', label: 'Nigeria — NGN (₦)' },
  { symbol: 'KSh', code: 'KES', country: 'Kenya', label: 'Kenya — KES (KSh)' },
  { symbol: '$', code: 'MXN', country: 'Mexico', label: 'Mexico — MXN ($)' },
  { symbol: '$', code: 'ARS', country: 'Argentina', label: 'Argentina — ARS ($)' },
  { symbol: '$', code: 'CLP', country: 'Chile', label: 'Chile — CLP ($)' },
  { symbol: '$', code: 'COP', country: 'Colombia', label: 'Colombia — COP ($)' },
  { symbol: '$', code: 'NZD', country: 'New Zealand', label: 'New Zealand — NZD ($)' },
  { symbol: '$', code: 'HKD', country: 'Hong Kong', label: 'Hong Kong — HKD ($)' },
  { symbol: 'NT$', code: 'TWD', country: 'Taiwan', label: 'Taiwan — TWD (NT$)' },
  { symbol: 'kn', code: 'HRK', country: 'Croatia', label: 'Croatia — HRK (kn)' },
  { symbol: 'lei', code: 'RON', country: 'Romania', label: 'Romania — RON (lei)' },
  { symbol: 'лв', code: 'BGN', country: 'Bulgaria', label: 'Bulgaria — BGN (лв)' },
  { symbol: 'RD$', code: 'DOP', country: 'Dominican Republic', label: 'Dominican Republic — DOP (RD$)' },
  { symbol: 'G', code: 'GTQ', country: 'Guatemala', label: 'Guatemala — GTQ (Q)' },
]

export const OTHER_KEY = '__other__'

/** Find a matching currency by symbol+code (for restoring the dropdown selection). */
export function findCurrency(symbol: string, code: string): CurrencyOption | null {
  return CURRENCIES.find((c) => c.symbol === symbol && c.code === code) ?? null
}
