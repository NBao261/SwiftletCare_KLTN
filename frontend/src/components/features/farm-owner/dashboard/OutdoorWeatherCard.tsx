import { CloudSunIcon, DropIcon, ThermometerIcon } from '@phosphor-icons/react'
import { Badge, Card } from '@/components/ui'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { NO_VALUE } from '@/constants/display'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useOutdoorWeatherNow } from '@/hooks/farm-owner/useAnalytics'
import { cn } from '@/lib/cn'

const HOUR_MS = 3_600_000

// Nhiệt độ, độ ẩm ngoài trời của trang trại chứa Zone. Khung nét đứt, nền xám nhạt và nhãn "ngoài trời" để không lẫn với số đo cảm biến trong nhà
export default function OutdoorWeatherCard({ zoneId }: { zoneId?: string }) {
  const { t, num, hourMinute } = useTranslation(dashboardDict)
  const { data: point, isLoading, isError } = useOutdoorWeatherNow(zoneId)

  // Bản ghi là số liệu của [giờ đó, giờ đó + 1 giờ)
  const period = point
    ? t('outdoor.period', { from: hourMinute(point.timestamp), to: hourMinute(new Date(Date.parse(point.timestamp) + HOUR_MS).toISOString()) })
    : ''
  let note = t('outdoor.subtitle')
  if (isError) note = t('outdoor.error')
  else if (!isLoading && !point) note = t('outdoor.empty')

  const stats = [
    { key: 'temperature', label: t('outdoor.temperature'), value: point?.temperature, unit: '°C', digits: 1, icon: ThermometerIcon },
    { key: 'humidity', label: t('outdoor.humidity'), value: point?.humidity, unit: '%', digits: 0, icon: DropIcon },
  ]

  return (
    <Card aria-label={t('outdoor.title')} className="flex flex-col gap-3 border-dashed border-warmGray/35 bg-warmGray/[0.05]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-h3 text-charcoal">
          <CloudSunIcon size={20} aria-hidden className="text-graphite" />
          {t('outdoor.title')}
        </h2>
        {period && <Badge tone="info">{period}</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map(stat => {
          const Icon = stat.icon
          const hasValue = stat.value !== undefined && stat.value !== null
          return (
            <div key={stat.key} className="flex items-center gap-3 rounded-xl border border-dashed border-warmGray/30 bg-white/70 px-3.5 py-3">
              <Icon size={18} className="shrink-0 text-warmGray" aria-hidden />
              <div className="min-w-0">
                <p className="label-caption truncate">{stat.label}</p>
                <p className={cn('text-xl font-extrabold leading-tight tabular-nums', hasValue ? 'text-charcoal' : 'text-warmGray')}>
                  {hasValue ? num(stat.value as number, stat.digits) : NO_VALUE}
                  <span className="ml-1 text-xs font-medium text-warmGray">{stat.unit}</span>
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-small text-warmGray">{note}</p>
    </Card>
  )
}
