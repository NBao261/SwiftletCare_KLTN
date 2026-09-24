import { ComponentType, SVGProps } from 'react'
import { Card } from '@/components/ui'
import { IconTemp, IconHumidity, IconLight, IconGas, IconSound } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

interface Reading {
  key: string
  label: string
  value: number | undefined
  unit: string
  decimals?: number
  icon: ComponentType<SVGProps<SVGSVGElement>>
  range: string
  isAnomaly?: boolean
}

interface EnvSensorPanelProps {
  temperature?: number
  humidity?: number
  lightLux?: number
  nh3?: number
  co2?: number
  soundDb?: number
  temperatureAnomaly?: boolean
  humidityAnomaly?: boolean
  nh3Anomaly?: boolean
  co2Anomaly?: boolean
  thresholds: {
    temp_min: number; temp_max: number
    humidity_min: number; humidity_max: number
    light_max: number; nh3_max: number; co2_max: number
  }
}

/**
 * 6 chỉ số RS485 thật của SensorNode (ENV-FR-003/005) — cùng nguồn `useTelemetry`
 * đang nuôi EcoHealthCard/ControlSubsystemPanel phía trên, không phải mock.
 */
export default function EnvSensorPanel({
  temperature, humidity, lightLux, nh3, co2, soundDb,
  temperatureAnomaly, humidityAnomaly, nh3Anomaly, co2Anomaly, thresholds: T,
}: EnvSensorPanelProps) {
  const readings: Reading[] = [
    { key: 'temp', label: 'Nhiệt độ', value: temperature, unit: '°C', icon: IconTemp, range: `${T.temp_min}–${T.temp_max}°C`, isAnomaly: temperatureAnomaly },
    { key: 'humidity', label: 'Độ ẩm', value: humidity, unit: '%', icon: IconHumidity, range: `${T.humidity_min}–${T.humidity_max}%`, isAnomaly: humidityAnomaly },
    { key: 'light', label: 'Ánh sáng', value: lightLux, unit: 'lux', icon: IconLight, range: `< ${T.light_max} lux` },
    { key: 'nh3', label: 'NH3', value: nh3, unit: 'ppm', icon: IconGas, range: `< ${T.nh3_max} ppm`, isAnomaly: nh3Anomaly },
    { key: 'co2', label: 'CO2', value: co2, unit: 'ppm', decimals: 0, icon: IconGas, range: `< ${T.co2_max} ppm`, isAnomaly: co2Anomaly },
    { key: 'sound', label: 'Âm thanh', value: soundDb, unit: 'dB', icon: IconSound, range: '—' },
  ]

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2 text-charcoal">Cảm biến môi trường thời gian thực</h2>
        <p className="mt-1 text-sm text-warmGray">6 chỉ số RS485 từ SensorNode tại zone đang xem</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {readings.map(r => (
          <ReadingTile key={r.key} reading={r} />
        ))}
      </div>
    </Card>
  )
}

function ReadingTile({ reading }: { reading: Reading }) {
  const { label, value, unit, decimals = 1, icon: Icon, range, isAnomaly } = reading
  const hasValue = value !== undefined && !Number.isNaN(value)
  const display = hasValue ? value.toFixed(decimals) : '--'

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-shadow',
        isAnomaly ? 'border-climateOrange/40 bg-climateOrange/[0.06]' : 'border-warmGray/15 bg-white',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="label-caption">{label}</span>
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
            isAnomaly ? 'bg-climateOrange text-white' : 'bg-warmGray/10 text-charcoal',
          )}
        >
          <Icon width={14} height={14} />
        </span>
      </div>

      <div className={cn('text-2xl font-extrabold leading-none tracking-tight', !hasValue ? 'text-warmGray' : isAnomaly ? 'text-climateOrange' : 'text-charcoal')}>
        {display}
        <span className="ml-1 text-xs font-medium text-warmGray">{unit}</span>
      </div>

      <p className="mt-1.5 h-4 text-[11px] font-medium text-warmGray">
        {isAnomaly ? 'Ngoài ngưỡng an toàn' : range !== '—' ? `An toàn ${range}` : ''}
      </p>
    </div>
  )
}
