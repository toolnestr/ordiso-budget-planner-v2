'use client'

import { useSettings } from '@/lib/api-hooks'
import { cn } from '@/lib/utils'

export function Currency({
  amount,
  className,
  sign = false,
  compact = false,
}: {
  amount: number
  className?: string
  sign?: boolean
  compact?: boolean
}) {
  const { data: settings } = useSettings()
  const sym = settings?.currencySymbol ?? '$'
  const abs = Math.abs(amount)
  const prefix = amount < 0 ? '-' : sign && amount > 0 ? '+' : ''
  let str: string
  if (compact && abs >= 1000) {
    str = abs >= 1_000_000 ? (abs / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M' : (abs / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  } else {
    str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return (
    <span className={cn('tabular-nums', className)}>
      {prefix}
      {sym}
      {str}
    </span>
  )
}
