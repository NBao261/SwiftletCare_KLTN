import { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface RadialGaugeProps {
  /** 0–100 */
  percent: number
  size?: number
  strokeWidth?: number
  /** Màu vòng tiến độ — class `stroke-*` (ăn theo currentColor qua Tailwind) */
  className?: string
  trackClassName?: string
  children?: ReactNode
}

/**
 * Vòng tròn tiến độ (donut gauge) — thuần trình bày, không biết domain: nhận
 * `percent` + màu qua className, không tự suy ra ý nghĩa % từ đâu. Dùng cho
 * mọi màn cần biểu diễn 1 giá trị/ngưỡng dạng vòng tròn (FE_Design_Claude.md §8 "Gauge/Bullet").
 */
export default function RadialGauge({
  percent, size = 88, strokeWidth = 8, className, trackClassName, children,
}: RadialGaugeProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, percent))
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth}
          className={cn('stroke-warmGray/15', trackClassName)}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          className={cn('stroke-charcoal transition-[stroke-dashoffset] duration-500', className)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
