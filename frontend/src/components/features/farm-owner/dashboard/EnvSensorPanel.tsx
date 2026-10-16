import type { ComponentType, SVGProps } from 'react'
import { Droplets, FlaskConical } from 'lucide-react'
import { Card } from '@/components/ui'
import SelectMenu, { type SelectMenuOption } from '@/components/ui/SelectMenu'
import { IconTemp, IconLight, IconCloud, IconSound } from '@/components/ui/icons'
import { useScopeZones, useZonesEnvironment } from '@/hooks/farm-owner/useFarmOwnerDashboard'
import type { AllZone } from '@/hooks/shared/useFarms'
import { useSyncedState } from '@/hooks/common/useSyncedState'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict, type DashboardKey } from '@/constants/dashboard.i18n'
import { getAnomalies } from '@/components/features/farm-owner/dashboard/dashboardMetrics'
import { cn } from '@/lib/cn'

const NO_ZONES: AllZone[] = []

interface Reading {
  key: string
  labelKey: DashboardKey
  value: number | undefined
  unit: string
  decimals: number
  icon: ComponentType<SVGProps<SVGSVGElement>>
  range: string
  isAnomaly: boolean
}

interface EnvSensorPanelProps {
  farmId: string
  houseOptions: SelectMenuOption<string>[]
  globalHouseId: string
}

// 6 chỉ số cảm biến môi trường
export default function EnvSensorPanel({ farmId, houseOptions, globalHouseId }: EnvSensorPanelProps) {
  const { t, num } = useTranslation(dashboardDict)
  const format = (value: number) => num(value, Number.isInteger(value) ? 0 : 1)
  const [choice, setChoice] = useSyncedState(globalHouseId)
  const houseId = houseOptions.some(option => option.value === choice) ? choice : ''
  const { zones } = useScopeZones(farmId, houseId)
  const { readings: env, thresholds, isActive, isLoading } = useZonesEnvironment(houseId ? zones : NO_ZONES)
  const anomalies = thresholds ? getAnomalies(env, thresholds) : undefined

  const readings: Reading[] = [
    { key: 'temp', labelKey: 'env.temperature', value: env.temperature, unit: '°C', decimals: 1, icon: IconTemp, range: thresholds ? `${format(thresholds.temp_min)}–${format(thresholds.temp_max)}°C` : '', isAnomaly: anomalies?.temperature ?? false },
    { key: 'humidity', labelKey: 'env.humidity', value: env.humidity, unit: '%', decimals: 1, icon: Droplets, range: thresholds ? `${format(thresholds.humidity_min)}–${format(thresholds.humidity_max)}%` : '', isAnomaly: anomalies?.humidity ?? false },
    { key: 'light', labelKey: 'env.light', value: env.light_lux, unit: 'lux', decimals: 1, icon: IconLight, range: thresholds ? `< ${format(thresholds.light_max)} lux` : '', isAnomaly: anomalies?.light ?? false },
    { key: 'nh3', labelKey: 'env.nh3', value: env.nh3_ppm, unit: 'ppm', decimals: 1, icon: FlaskConical, range: thresholds ? `< ${format(thresholds.nh3_max)} ppm` : '', isAnomaly: anomalies?.nh3 ?? false },
    { key: 'co2', labelKey: 'env.co2', value: env.co2_ppm, unit: 'ppm', decimals: 0, icon: IconCloud, range: thresholds ? `< ${format(thresholds.co2_max)} ppm` : '', isAnomaly: anomalies?.co2 ?? false },
    { key: 'sound', labelKey: 'env.sound', value: env.sound_db, unit: 'dB', decimals: 1, icon: IconSound, range: '', isAnomaly: false },
  ]

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h2 text-charcoal">{t('env.title')}</h2>
          <p className="mt-1 text-sm text-warmGray">{t('env.subtitle')}</p>
        </div>
        <SelectMenu ariaLabel={t('env.houseLabel')} value={houseId} options={houseOptions} onChange={setChoice} className="w-40 justify-between" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {readings.map(reading => (
          <ReadingTile key={reading.key} reading={reading} isLoading={isLoading} isActive={isActive} />
        ))}
      </div>
    </Card>
  )
}

const ICON_CLASS = { anomaly: 'bg-climateOrange text-white', safe: 'bg-warmGray/10 text-success', idle: 'bg-warmGray/10 text-charcoal' }

// 1 ô cảm biến: cam khi vượt ngưỡng, icon xanh khi an toàn, xám khi chưa có thiết bị chạy
function ReadingTile({ reading, isLoading, isActive }: { reading: Reading; isLoading: boolean; isActive: boolean }) {
  const { t, num } = useTranslation(dashboardDict)
  const { labelKey, value, unit, decimals, icon: Icon, range } = reading
  const hasValue = !isLoading && value !== undefined && !Number.isNaN(value)
  const isAnomaly = isActive && reading.isAnomaly
  const isSafe = isActive && hasValue && !isAnomaly && range !== ''
  const iconTone = isAnomaly ? 'anomaly' : isSafe ? 'safe' : 'idle'

  return (
    <div className={cn('rounded-2xl border p-4 transition-shadow', isAnomaly ? 'border-climateOrange/40 bg-climateOrange/[0.06]' : 'border-warmGray/15 bg-white')}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="label-caption">{t(labelKey)}</span>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', ICON_CLASS[iconTone])}>
          <Icon width={14} height={14} />
        </span>
      </div>

      <div className={cn('text-2xl font-extrabold leading-none tracking-tight', !hasValue ? 'text-warmGray' : isAnomaly ? 'text-climateOrange' : 'text-charcoal')}>
        {hasValue ? num(value, decimals) : '_'}
        <span className="ml-1 text-xs font-medium text-warmGray">{unit}</span>
      </div>

      <p className="mt-1.5 h-4 text-[11px] font-medium text-warmGray">
        {isAnomaly ? t('env.outOfRange') : range ? t('env.safe', { range }) : ''}
      </p>
    </div>
  )
}
