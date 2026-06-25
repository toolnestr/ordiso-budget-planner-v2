'use client'

import { cn } from '@/lib/utils'

export function ProgressBar({
  value,
  className,
  barClassName,
  color,
  height = 'h-2',
}: {
  value: number
  className?: string
  barClassName?: string
  color?: string
  height?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('w-full rounded-full bg-muted overflow-hidden', height, className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500 ease-out', barClassName ?? 'bg-primary')}
        style={{ width: `${pct}%`, ...(color ? { backgroundColor: color } : {}) }}
      />
    </div>
  )
}
