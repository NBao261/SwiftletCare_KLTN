import { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { trChildren } from '@/i18n'

/**
 * Badge — pill trạng thái, giới hạn trong bảng màu chuẩn (FE_Design_Claude.md §2).
 * Map ý nghĩa: positive/ONLINE→nền accent-600 #B5D32C + chữ charcoal (cùng cặp màu icon nav active ở sidebar; thay LIME MIST vì nhạt quá), warning/MEDIUM→climateOrange,
 * critical/HIGH→alertRed, neutral/OFFLINE→warmGray, info→graphite.
 */
export type BadgeTone = 'positive' | 'warning' | 'critical' | 'neutral' | 'info'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const TONE_CLASS: Record<BadgeTone, string> = {
  positive: 'bg-accent-600 text-charcoal',
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
      {trChildren(children)}
    </span>
  )
}
