import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { MetricMeta } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { cn } from '@/lib/cn'
import { NO_VALUE } from '@/constants/display'

interface ThresholdMetricCardProps {
  meta: MetricMeta
  value: number | undefined
  // Khoảng an toàn đã định dạng (VD "26–35 °C"); undefined = Zone chưa cấu hình ngưỡng cho chỉ số này
  range?: string
  // true = giá trị đang ngoài ngưỡng
  isAnomaly?: boolean
}

// 1 chỉ số của Zone
export default function ThresholdMetricCard({ meta, value, range, isAnomaly }: ThresholdMetricCardProps) {
  const { t, num } = useTranslation(farmDict)
  const hasValue = value !== undefined && !Number.isNaN(value)

  return (
    <div className={cn('rounded-2xl border p-4', isAnomaly ? 'border-climateOrange/40 bg-climateOrange/[0.06]' : 'border-warmGray/15 bg-white')}>
      <p className="label-caption mb-2">{t(meta.labelKey)}</p>

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
