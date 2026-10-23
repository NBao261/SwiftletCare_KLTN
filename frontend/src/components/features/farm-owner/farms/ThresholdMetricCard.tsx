import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { MetricMeta } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { cn } from '@/lib/cn'
import { NO_VALUE } from '@/constants/display'

interface ThresholdMetricCardProps {
  meta: MetricMeta
  value: number | undefined
  /** Khoảng an toàn đã định dạng (VD "26–35 °C"); undefined = Zone chưa cấu hình ngưỡng cho chỉ số này */
  range?: string
  /** true = giá trị đang ngoài ngưỡng */
  isAnomaly?: boolean
}

/** 1 chỉ số của Zone — cùng kiểu ReadingTile ở EnvSensorPanel (Dashboard): nhãn trái + icon tròn phải, số lớn, dòng "An toàn …" */
export default function ThresholdMetricCard({ meta, value, range, isAnomaly }: ThresholdMetricCardProps) {
  const { t, num } = useTranslation(farmDict)
  const Icon = meta.icon
  const hasValue = value !== undefined && !Number.isNaN(value)

  return (
    <div className={cn('rounded-2xl border p-4', isAnomaly ? 'border-climateOrange/40 bg-climateOrange/[0.06]' : 'border-warmGray/15 bg-white')}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="label-caption">{t(meta.labelKey)}</span>
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
            isAnomaly ? 'bg-climateOrange text-white' : 'bg-warmGray/10 text-charcoal',
          )}
        >
          <Icon size={14} weight="bold" />
        </span>
      </div>

      <div className={cn('text-2xl font-extrabold leading-none tracking-tight', !hasValue ? 'text-warmGray' : isAnomaly ? 'text-climateOrange' : 'text-charcoal')}>
        {hasValue ? num(value, meta.decimals) : NO_VALUE}
        <span className="ml-1 text-xs font-medium text-warmGray">{meta.unit}</span>
      </div>

      <p className="mt-1.5 h-4 truncate text-caption font-medium tracking-normal text-warmGray">
        {isAnomaly ? t('metric.outOfRange') : range ? t('metric.safe', { range }) : ''}
      </p>
    </div>
  )
}
