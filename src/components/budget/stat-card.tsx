'use client'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-primary',
  sublabel,
  trend,
  className,
}: {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  iconColor?: string
  sublabel?: React.ReactNode
  trend?: { value: string; positive: boolean }
  className?: string
}) {
  return (
    <Card className={cn('p-5 gap-0 relative overflow-hidden', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
        </div>
        {Icon && (
          <div className={cn('rounded-lg bg-primary/10 p-2 shrink-0', iconColor)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      {trend && (
        <div className={cn('mt-3 inline-flex items-center gap-1 text-xs font-medium', trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
          {trend.positive ? '▲' : '▼'} {trend.value}
        </div>
      )}
    </Card>
  )
}
