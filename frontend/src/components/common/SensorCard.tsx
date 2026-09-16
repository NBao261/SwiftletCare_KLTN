import { ComponentType, SVGProps } from 'react'
import { cn } from '@/utils/cn'

interface SensorCardProps {
  label: string
  value: number | undefined
  unit: string
  decimals?: number
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  /** Khoảng an toàn để người dùng biết "bao nhiêu là đủ" mà không phải mở trang cấu hình */
  range?: string
  /** true nếu giá trị vượt ngưỡng cấu hình (ENV-FR-004 is_anomaly) */
  isAnomaly?: boolean
}

/**
 * SensorCard — 1 chỉ số môi trường (Metric lớn 36-40px ExtraBold, §4.3).
 *
 * Vượt ngưỡng dùng Climate Orange chứ không phải Alert Red: theo §1, Climate
 * Orange là "cảnh báo vi khí hậu" (nhiệt/ẩm/khí lệch ngưỡng), còn Alert Red dành
 * riêng cho khẩn cấp thật (thiên địch, Live).
 */
export default function SensorCard({
  label, value, unit, decimals = 1, icon: Icon, range, isAnomaly,
}: SensorCardProps) {
  const hasValue = value !== undefined && !Number.isNaN(value)
  const display = hasValue ? value.toFixed(decimals) : '--'

  return (
    <div
      className={cn(
        'group rounded-2xl border p-5 transition-shadow',
        isAnomaly
          ? 'border-climateOrange/40 bg-climateOrange/[0.06] shadow-card'
          : 'border-warmGray/15 bg-white shadow-card hover:shadow-dock',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="label-caption">{label}</span>
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
              isAnomaly ? 'bg-climateOrange text-white' : 'bg-warmGray/10 text-charcoal',
            )}
          >
            <Icon width={16} height={16} />
          </span>
        )}
      </div>

      <div
        className={cn(
          'text-[34px] font-extrabold leading-none tracking-tight',
          !hasValue ? 'text-warmGray' : isAnomaly ? 'text-climateOrange' : 'text-charcoal',
        )}
      >
        {display}
        <span className="ml-1 text-base font-medium text-warmGray">{unit}</span>
      </div>

      <p className="mt-2 h-4 text-xs font-medium text-warmGray">
        {isAnomaly ? 'Ngoài ngưỡng an toàn' : range ? `An toàn ${range}` : ''}
      </p>
    </div>
  )
}
