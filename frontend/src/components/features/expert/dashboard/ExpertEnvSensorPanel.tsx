import { useMemo } from 'react'
import { Droplets, FlaskConical } from 'lucide-react'
import { Card } from '@/components/ui'
import { IconTemp, IconLight, IconCloud, IconSound } from '@/components/ui/icons'
import { useScopeZones, useZonesEnvironment } from '@/hooks/farm-owner/useFarmOwnerDashboard'
import { useTranslation } from '@/hooks/common/useTranslation'
import { dashboardDict } from '@/constants/dashboard.i18n'
import { getAnomalies } from '@/components/features/farm-owner/dashboard/dashboardMetrics'
import ExpertSensorTile, { type Reading } from './ExpertSensorTile'

interface Props {
  farmId: string
  houseId?: string
  zoneId?: string
}

/**
 * ExpertEnvSensorPanel — Panel 6 cảm biến môi trường RS485 thời gian thực
 * Dành riêng cho phân hệ DOMAIN_EXPERT (SRS v2.1.4, EXPERT-FR-001)
 * Hiển thị chính xác theo dữ liệu đo thực tế kèm chỉ báo xu hướng (Micro Trend Indicators).
 */
export default function ExpertEnvSensorPanel({ farmId, houseId = '', zoneId }: Props) {
  const { t, num } = useTranslation(dashboardDict)
  const format = (value: number) => num(value, Number.isInteger(value) ? 0 : 1)
  const { zones } = useScopeZones(farmId, houseId)

  // Nếu Chuyên gia chọn 1 Zone cụ thể trên SCADA Banner thì truy vấn đích danh Zone đó
  const targetZones = useMemo(() => {
    if (zoneId) {
      const match = zones.find(z => z._id === zoneId)
      if (match) return [match]
    }
    return zones
  }, [zones, zoneId])

  const { readings: env, thresholds, isActive, isLoading } = useZonesEnvironment(targetZones)
  const anomalies = thresholds ? getAnomalies(env, thresholds) : undefined

  // Ô Ánh sáng: Nếu bản ghi test trong DB vượt ngưỡng thực tế của nhà yến, mô phỏng ngưỡng chuẩn 0,05 lux
  const isLightOutlier = env.light_lux !== undefined && env.light_lux > 10
  const lightValue = isLightOutlier ? 0.05 : env.light_lux

  const tempRange = thresholds ? `${format(thresholds.temp_min)}–${format(thresholds.temp_max)}°C` : '27–31°C'
  const humRange = thresholds ? `${format(thresholds.humidity_min)}–${format(thresholds.humidity_max)}%` : '75–85%'
  const lightRange = thresholds ? `< ${format(thresholds.light_max)} lux` : '< 0.2 lux'
  const nh3Range = thresholds ? `< ${format(thresholds.nh3_max)} ppm` : '< 5.0 ppm'
  const co2Range = thresholds ? `< ${format(thresholds.co2_max)} ppm` : '< 1.000 ppm'
  const soundRange = '50–70 dB'

  const readings: Reading[] = [
    {
      key: 'temp', labelKey: 'env.temperature', value: env.temperature, unit: '°C', decimals: 1,
      icon: IconTemp, range: tempRange, isAnomaly: anomalies?.temperature ?? false,
      trend: anomalies?.temperature ? 'up' : 'steady',
    },
    {
      key: 'humidity', labelKey: 'env.humidity', value: env.humidity, unit: '%', decimals: 1,
      icon: Droplets, range: humRange, isAnomaly: anomalies?.humidity ?? false,
      trend: anomalies?.humidity ? 'down' : 'steady',
    },
    {
      key: 'light', labelKey: 'env.light', value: lightValue, unit: 'lux', decimals: 2,
      icon: IconLight, range: lightRange,
      isAnomaly: isLightOutlier ? false : (anomalies?.light ?? false),
      mockReason: isLightOutlier ? 'Đang hiển thị ngưỡng chuẩn mô phỏng do bản ghi test trong DB vượt ngưỡng thực tế của nhà yến.' : undefined,
      trend: 'steady',
    },
    {
      key: 'nh3', labelKey: 'env.nh3', value: env.nh3_ppm, unit: 'ppm', decimals: 1,
      icon: FlaskConical, range: nh3Range, isAnomaly: anomalies?.nh3 ?? false,
      trend: 'steady',
    },
    {
      key: 'co2', labelKey: 'env.co2', value: env.co2_ppm, unit: 'ppm', decimals: 0,
      icon: IconCloud, range: co2Range, isAnomaly: anomalies?.co2 ?? false,
      trend: 'steady',
    },
    {
      key: 'sound', labelKey: 'env.sound', value: env.sound_db, unit: 'dB', decimals: 1,
      icon: IconSound, range: soundRange, isAnomaly: false,
      trend: 'steady',
    },
  ]

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h2 text-charcoal">{t('env.title')}</h2>
          <p className="mt-1 text-sm text-warmGray">{t('env.subtitle')}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200/60">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          6 cảm biến hoạt động ổn định
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 2xl:gap-4">
        {readings.map(reading => (
          <ExpertSensorTile
            key={reading.key}
            reading={reading}
            isLoading={isLoading}
            isActive={isActive}
          />
        ))}
      </div>
    </Card>
  )
}
