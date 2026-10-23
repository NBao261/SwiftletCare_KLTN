import { useMemo, type ComponentType, type ReactNode, type SVGProps } from 'react'
import { CloudIcon, DropIcon, FlaskIcon, SunIcon, ThermometerIcon, WaveformIcon } from '@phosphor-icons/react'
import { useZonesEnvironment } from '@/hooks/farm-owner/useFarmOwnerDashboard'
import type { AllZone } from '@/hooks/shared/useFarms'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict, type DashboardKey } from '@/constants/dashboard.i18n'
import { getAnomalies, thresholdSource } from '@/components/features/farm-owner/dashboard/dashboardMetrics'
import { NO_VALUE } from '@/constants/display'
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
  // NH3, CO2 chỉ theo dõi và cảnh báo, không điều khiển quạt (ENV-FR-006/011) — ghi "Cảnh báo khi …" thay vì "An toàn"
  isAlertOnly: boolean
  isAnomaly: boolean
}

interface EnvSensorPanelProps {
  // Zone đang xem; số đo và ngưỡng luôn của đúng 1 Zone, không gộp nhiều Zone
  zone?: AllZone
  // Ô chọn Zone + nút đồng bộ đặt ở góc phải header
  scopeControl?: ReactNode
  // Đang đồng bộ Zone với khung Điều khiển: viền nổi để thấy 2 khung đang đi cùng nhau
  isLinked?: boolean
}

// Khung card chứa 6 chỉ số cảm biến môi trường của 1 Zone, đặt ngay dưới ảnh đầu trang
export default function EnvSensorPanel({ zone, scopeControl, isLinked = false }: EnvSensorPanelProps) {
  const { t, num, date } = useTranslation(dashboardDict)
  const format = (value: number) => num(value, Number.isInteger(value) ? 0 : 1)
  const scopeZones = useMemo(() => (zone ? [zone] : NO_ZONES), [zone])
  const { readings: env, thresholds, isActive, isLoading } = useZonesEnvironment(scopeZones)
  const anomalies = thresholds ? getAnomalies(env, thresholds) : undefined

  const readings: Reading[] = [
    { key: 'temp', labelKey: 'env.temperature', value: env.temperature, unit: '°C', decimals: 1, icon: ThermometerIcon, range: thresholds ? `${format(thresholds.temp_min)}–${format(thresholds.temp_max)}°C` : '', isAlertOnly: false, isAnomaly: anomalies?.temperature ?? false },
    { key: 'humidity', labelKey: 'env.humidity', value: env.humidity, unit: '%', decimals: 1, icon: DropIcon, range: thresholds ? `${format(thresholds.humidity_min)}–${format(thresholds.humidity_max)}%` : '', isAlertOnly: false, isAnomaly: anomalies?.humidity ?? false },
    { key: 'light', labelKey: 'env.light', value: env.light_lux, unit: 'lux', decimals: 1, icon: SunIcon, range: thresholds ? `< ${format(thresholds.light_max)} lux` : '', isAlertOnly: false, isAnomaly: anomalies?.light ?? false },
    { key: 'nh3', labelKey: 'env.nh3', value: env.nh3_ppm, unit: 'ppm', decimals: 1, icon: FlaskIcon, range: thresholds ? `> ${format(thresholds.nh3_max)} ppm` : '', isAlertOnly: true, isAnomaly: anomalies?.nh3 ?? false },
    { key: 'co2', labelKey: 'env.co2', value: env.co2_ppm, unit: 'ppm', decimals: 0, icon: CloudIcon, range: thresholds ? `> ${format(thresholds.co2_max)} ppm` : '', isAlertOnly: true, isAnomaly: anomalies?.co2 ?? false },
    { key: 'sound', labelKey: 'env.sound', value: env.sound_db, unit: 'dB', decimals: 1, icon: WaveformIcon, range: '', isAlertOnly: false, isAnomaly: false },
  ]

  // Ai đặt ngưỡng đang áp: đọc từ lịch sử ngưỡng backend trả về, không ghi cứng
  const source = thresholdSource(zone?.threshold_history)
  let sourceText = ''
  if (zone && source.isDefault) sourceText = t('env.sourceDefault')
  if (zone && !source.isDefault) {
    const setter = source.role && ['FARM_OWNER', 'DOMAIN_EXPERT', 'TECHNICIAN', 'ADMIN'].includes(source.role)
      ? t(`env.setter.${source.role as 'FARM_OWNER'}`)
      : t('env.setter.other')
    sourceText = t('env.sourceManual', { setter, date: source.changedAt ? date(source.changedAt) : NO_VALUE })
  }

  return (
    // Khung ngoài kính mờ (glass-panel, mẫu 5.2.1) để thấy ảnh đầu trang phía sau; 6 thẻ bên trong giữ nền trắng
    <section
      aria-label={t('env.title')}
      className={cn(
        'glass-panel flex flex-col gap-4 rounded-3xl border border-white/60 p-6 shadow-glass backdrop-blur-xl transition-shadow duration-300',
        isLinked && 'ring-2 ring-charcoal/25',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h2 text-charcoal">{t('env.title')}</h2>
          {/* Chưa có Zone: mỗi Zone có ngưỡng riêng nên không gộp số liệu, nhắc chọn 1 nhà ở bộ lọc trên header */}
          <p className="mt-1 text-sm text-warmGray">{zone ? t('env.subtitleZone', { zone: zone.name }) : t('env.pickHouse')}</p>
          {sourceText && <p className="mt-0.5 text-xs text-warmGray">{sourceText}</p>}
        </div>
        {scopeControl}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {readings.map(reading => (
          <ReadingTile key={reading.key} reading={reading} isLoading={isLoading} isActive={isActive} />
        ))}
      </div>
    </section>
  )
}

const ICON_CLASS = { anomaly: 'bg-climateOrange text-white', safe: 'bg-warmGray/10 text-success', idle: 'bg-warmGray/10 text-charcoal' }

// 1 ô cảm biến: cam khi vượt ngưỡng, icon xanh khi an toàn, xám khi chưa có thiết bị chạy
function ReadingTile({ reading, isLoading, isActive }: { reading: Reading; isLoading: boolean; isActive: boolean }) {
  const { t, num } = useTranslation(dashboardDict)
  const { labelKey, value, unit, decimals, icon: Icon, range, isAlertOnly } = reading
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
        {hasValue ? num(value, decimals) : NO_VALUE}
        <span className="ml-1 text-xs font-medium text-warmGray">{unit}</span>
      </div>

      <p className="mt-1.5 h-4 text-[11px] font-medium text-warmGray">
        {isAnomaly && t(isAlertOnly ? 'env.overAlert' : 'env.outOfRange')}
        {!isAnomaly && range && t(isAlertOnly ? 'env.alertAbove' : 'env.safe', { range })}
      </p>
    </div>
  )
}
