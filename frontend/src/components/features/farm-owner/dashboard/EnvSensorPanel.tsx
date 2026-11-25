import type { ComponentType, SVGProps } from 'react'
import { CloudIcon, DropIcon, FlaskIcon, SunIcon, ThermometerIcon, WarningIcon, WaveformIcon } from '@phosphor-icons/react'
import { Card } from '@/components/ui'
import type { useZonesEnvironment } from '@/hooks/farm-owner/useFarmOwnerDashboard'
import type { AllZone } from '@/hooks/shared/useFarms'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict, type DashboardKey } from '@/constants/dashboard.i18n'
import { getAnomalies } from '@/components/features/farm-owner/dashboard/dashboardMetrics'
import { NO_VALUE } from '@/constants/display'
import { cn } from '@/lib/cn'

interface Reading {
  key: string
  labelKey: DashboardKey
  value: number | undefined
  unit: string
  decimals: number
  icon: ComponentType<SVGProps<SVGSVGElement>>
  range: string
  // NH3, CO2 chỉ theo dõi và cảnh báo, không điều khiển quạt: ghi "Cảnh báo khi …" thay vì "An toàn"
  isAlertOnly: boolean
  isAnomaly: boolean
}

interface EnvSensorPanelProps {
  // Zone đang xem; số đo và ngưỡng luôn của đúng 1 Zone, không gộp nhiều Zone
  zone?: AllZone
  // Số đo của Zone đó, trang tải 1 lần để dùng chung với khung điều khiển
  env: ReturnType<typeof useZonesEnvironment>
}

// 6 chỉ số cảm biến môi trường của 1 Zone
export default function EnvSensorPanel({ zone, env: zoneEnv }: EnvSensorPanelProps) {
  const { t, num } = useTranslation(dashboardDict)
  const format = (value: number) => num(value, Number.isInteger(value) ? 0 : 1)
  const { readings: env, thresholds, isActive, isLoading } = zoneEnv
  const anomalies = thresholds ? getAnomalies(env, thresholds) : undefined

  const readings: Reading[] = [
    { key: 'temp', labelKey: 'env.temperature', value: env.temperature, unit: '°C', decimals: 1, icon: ThermometerIcon, range: thresholds ? `${format(thresholds.temp_min)}–${format(thresholds.temp_max)}°C` : '', isAlertOnly: false, isAnomaly: anomalies?.temperature ?? false },
    { key: 'humidity', labelKey: 'env.humidity', value: env.humidity, unit: '%', decimals: 1, icon: DropIcon, range: thresholds ? `${format(thresholds.humidity_min)}–${format(thresholds.humidity_max)}%` : '', isAlertOnly: false, isAnomaly: anomalies?.humidity ?? false },
    { key: 'light', labelKey: 'env.light', value: env.light_lux, unit: 'lux', decimals: 1, icon: SunIcon, range: thresholds ? `< ${format(thresholds.light_max)} lux` : '', isAlertOnly: false, isAnomaly: anomalies?.light ?? false },
    { key: 'nh3', labelKey: 'env.nh3', value: env.nh3_ppm, unit: 'ppm', decimals: 1, icon: FlaskIcon, range: thresholds ? `> ${format(thresholds.nh3_max)} ppm` : '', isAlertOnly: true, isAnomaly: anomalies?.nh3 ?? false },
    { key: 'co2', labelKey: 'env.co2', value: env.co2_ppm, unit: 'ppm', decimals: 0, icon: CloudIcon, range: thresholds ? `> ${format(thresholds.co2_max)} ppm` : '', isAlertOnly: true, isAnomaly: anomalies?.co2 ?? false },
    { key: 'sound', labelKey: 'env.sound', value: env.sound_db, unit: 'dB', decimals: 1, icon: WaveformIcon, range: '', isAlertOnly: false, isAnomaly: false },
  ]

  return (
    <Card size="lg" aria-label={t('env.title')} className="flex h-full flex-col gap-4">
      <div className="min-w-0">
        <h2 className="text-h2 text-charcoal">{t('env.title')}</h2>
        <p className="mt-1 text-sm text-warmGray">{zone ? t('env.subtitleZone', { zone: zone.name }) : t('env.pickHouse')}</p>
      </div>

      <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-3">
        {readings.map(reading => (
          <ReadingTile key={reading.key} reading={reading} isLoading={isLoading} isActive={isActive} />
        ))}
      </div>
    </Card>
  )
}

// 1 ô cảm biến: cam kèm icon cảnh báo khi vượt ngưỡng, xám khi chưa có số
function ReadingTile({ reading, isLoading, isActive }: { reading: Reading; isLoading: boolean; isActive: boolean }) {
  const { t, num } = useTranslation(dashboardDict)
  const { labelKey, value, unit, decimals, icon: Icon, range, isAlertOnly } = reading
  const hasValue = !isLoading && value !== undefined && !Number.isNaN(value)
  const isAnomaly = isActive && reading.isAnomaly

  return (
    <div className={cn('flex flex-col justify-between gap-2 rounded-2xl border p-4', isAnomaly ? 'border-climateOrange/40 bg-climateOrange/[0.06]' : 'border-warmGray/15 bg-white')}>
      <div className="flex items-center gap-2 text-warmGray">
        <Icon width={16} height={16} className={cn(isAnomaly && 'text-climateOrange')} />
        <span className="label-caption">{t(labelKey)}</span>
      </div>

      <div className={cn('text-2xl font-extrabold leading-none tracking-tight tabular-nums', !hasValue ? 'text-warmGray' : isAnomaly ? 'text-climateOrange' : 'text-charcoal')}>
        {hasValue ? num(value, decimals) : NO_VALUE}
        <span className="ml-1 text-xs font-medium text-warmGray">{unit}</span>
      </div>

      <p className={cn('flex min-h-4 items-center gap-1 text-small font-medium', isAnomaly ? 'text-climateOrange' : 'text-warmGray')}>
        {isAnomaly && <WarningIcon size={14} weight="bold" aria-hidden />}
        {isAnomaly ? t(isAlertOnly ? 'env.overAlert' : 'env.outOfRange') : range && t(isAlertOnly ? 'env.alertAbove' : 'env.safe', { range })}
      </p>
    </div>
  )
}
