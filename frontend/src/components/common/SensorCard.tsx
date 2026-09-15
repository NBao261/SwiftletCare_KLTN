import { ReactNode } from 'react'
import { Card } from '@/components/ui'
import { cn } from '@/utils/cn'

interface SensorCardProps {
  label: string
  value: number | undefined
  unit: string
  decimals?: number
  icon?: ReactNode
  /** true nếu giá trị vượt ngưỡng cấu hình (ENV-FR-004 is_anomaly) — tô alertRed */
  isAnomaly?: boolean
}

/** SensorCard – 1 chỉ số cảm biến (Metric lớn theo mục 4.3: 36-40px ExtraBold) */
export default function SensorCard({ label, value, unit, decimals = 1, icon, isAnomaly }: SensorCardProps) {
  const display = value === undefined || Number.isNaN(value) ? '--' : value.toFixed(decimals)

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <span className="label-caption">{label}</span>
        {icon && <span className="text-warmGray">{icon}</span>}
      </div>
      <div className={cn('text-4xl font-extrabold tracking-tight', isAnomaly ? 'text-alertRed' : 'text-charcoal')}>
        {display}
        <span className="ml-1 text-base font-medium text-warmGray">{unit}</span>
      </div>
    </Card>
  )
}
