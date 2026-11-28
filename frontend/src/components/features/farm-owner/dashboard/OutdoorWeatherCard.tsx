import { CloudSunIcon, DropIcon, ThermometerIcon } from '@phosphor-icons/react'
import { Card } from '@/components/ui'
import { WEATHER_TONE_CLASS, WeatherCredit, WeatherGlyph } from '@/components/common/CurrentWeather'
import { describeWeather, rainfallText } from '@/components/common/currentWeather.utils'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { NO_VALUE } from '@/constants/display'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useOutdoorWeatherNow } from '@/hooks/farm-owner/useAnalytics'
import { useCurrentWeather } from '@/hooks/shared/useCurrentWeather'
import { cn } from '@/lib/cn'
import { t as translateSentence } from '@/i18n'

const HOUR_MS = 3_600_000

// Khung thời tiết ngoài trời của nhà
export default function OutdoorWeatherCard({ zoneId, houseId }: { zoneId?: string; houseId?: string }) {
  const { t, num, hourMinute } = useTranslation(dashboardDict)
  const current = useCurrentWeather(houseId)
  const hourly = useOutdoorWeatherNow(zoneId)
  const weather = current.data?.weather ?? null
  const point = hourly.data

  // Có số hiện tại thì chỉ dùng số đó (số null là chưa có, không lấy số theo giờ thay), để cả khung cùng một giờ
  const temperature = weather ? weather.temperature_c : point?.temperature
  const humidity = weather ? weather.humidity_pct : point?.humidity
  const isLoading = (current.isLoading || hourly.isLoading) && !weather && !point
  const hasNumbers = (temperature !== undefined && temperature !== null) || (humidity !== undefined && humidity !== null)

  // Chỉ khi cả hai nguồn đều không có số mới báo lỗi hoặc báo chưa có
  const emptyNote = isLoading || hasNumbers || weather ? null : t(current.isError && hourly.isError ? 'outdoor.error' : 'outdoor.empty')
  // Dùng số theo giờ: nói rõ là số của giờ nào
  const hourlyPeriod = !weather && point
    ? t('outdoor.period', { from: hourMinute(point.timestamp), to: hourMinute(new Date(Date.parse(point.timestamp) + HOUR_MS).toISOString()) })
    : null

  const stats = [
    { key: 'temperature', label: t('outdoor.temperature'), value: temperature, unit: '°C', digits: 1, icon: ThermometerIcon },
    { key: 'humidity', label: t('outdoor.humidity'), value: humidity, unit: '%', digits: 0, icon: DropIcon },
  ]
  const sky = weather ? describeWeather(weather) : null
  const rainfall = weather ? rainfallText(weather) : null

  return (
    <Card aria-label={t('outdoor.title')} className="flex flex-col gap-3 border-dashed border-warmGray/35 bg-warmGray/[0.05]">
      <h2 className="flex items-center gap-2 text-h3 text-charcoal">
        <CloudSunIcon size={20} aria-hidden className="text-graphite" />
        {t('outdoor.title')}
      </h2>

      {sky && (
        <div className={cn('flex items-center gap-3 rounded-2xl px-4 py-3', WEATHER_TONE_CLASS[sky.tone])}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/70">
            <WeatherGlyph icon={sky.icon} size={30} />
          </span>
          <div className="min-w-0">
            <p className="text-h3 font-bold leading-tight">{translateSentence(sky.label)}</p>
            {rainfall && <p className="text-small text-graphite">{rainfall}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {stats.map(stat => {
          const Icon = stat.icon
          const hasValue = stat.value !== undefined && stat.value !== null
          return (
            <div key={stat.key} className="flex items-center gap-3 rounded-xl border border-dashed border-warmGray/30 bg-white/70 px-3.5 py-3">
              <Icon size={18} className="shrink-0 text-warmGray" aria-hidden />
              <div className="min-w-0">
                <p className="label-caption">{stat.label}</p>
                <p className={cn('text-xl font-extrabold leading-tight tabular-nums', hasValue ? 'text-charcoal' : 'text-warmGray')}>
                  {hasValue ? num(stat.value as number, stat.digits) : NO_VALUE}
                  <span className="ml-1 text-xs font-medium text-warmGray">{stat.unit}</span>
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Một dòng chân khung: số này ở đâu, của giờ nào, nguồn nào */}
      {emptyNote ? (
        <p className="text-small text-warmGray">{emptyNote}</p>
      ) : (
        <p className="text-small text-warmGray">
          {hourlyPeriod && `${hourlyPeriod}. `}{t('outdoor.subtitle')}{' '}
          <WeatherCredit observedAt={weather?.observed_at} />
        </p>
      )}
    </Card>
  )
}
