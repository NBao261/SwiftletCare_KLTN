import { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

/**
 * Badge — pill trạng thái, giới hạn trong bảng màu chuẩn (FE_Design_Claude.md §2).
 * Map ý nghĩa: positive/ONLINE→success (accent-600, §2.5), warning/MEDIUM→climateOrange,
 * critical/HIGH→alertRed, neutral/OFFLINE→warmGray, info→graphite.
 */
export type BadgeTone = 'positive' | 'warning' | 'critical' | 'neutral' | 'info'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const TONE_CLASS: Record<BadgeTone, string> = {
  positive: 'bg-success/15 text-accent-800',
  warning:  'bg-climateOrange/15 text-climateOrange',
  critical: 'bg-alertRed/15 text-alertRed',
  neutral:  'bg-warmGray/15 text-warmGray',
  info:     'bg-graphite/10 text-graphite',
}

export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
