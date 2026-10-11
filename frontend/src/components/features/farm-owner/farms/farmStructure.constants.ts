import type { Icon } from '@phosphor-icons/react'
import { CloudIcon, DropIcon, SpeakerHighIcon, SunIcon, ThermometerIcon, WindIcon } from '@phosphor-icons/react'
import type { Thresholds } from '@/types'
import type { MetricKey } from '@/components/features/farm-owner/farms/farmStructure'
import type { farmDict } from '@/constants/farmStructure.i18n'

type FarmKey = keyof typeof farmDict.vi

export interface MetricMeta {
  key: MetricKey | 'sound'
  labelKey: FarmKey
  unit: string
  decimals: number
  icon: Icon
}

/** 6 chỉ số của Zone, đúng thứ tự hiển thị ở màn chi tiết zone (đơn vị đo không dịch — FE_Design §6) */
export const ZONE_METRICS: MetricMeta[] = [
  { key: 'temperature', labelKey: 'metric.temperature', unit: '°C', decimals: 1, icon: ThermometerIcon },
  { key: 'humidity', labelKey: 'metric.humidity', unit: '%', decimals: 0, icon: DropIcon },
  { key: 'light', labelKey: 'metric.light', unit: 'lux', decimals: 2, icon: SunIcon },
  { key: 'nh3', labelKey: 'metric.nh3', unit: 'ppm', decimals: 0, icon: WindIcon },
  { key: 'co2', labelKey: 'metric.co2', unit: 'ppm', decimals: 0, icon: CloudIcon },
  { key: 'sound', labelKey: 'metric.sound', unit: 'dB', decimals: 0, icon: SpeakerHighIcon },
]

/** Khoảng an toàn của 1 chỉ số để hiện dưới số đo; âm thanh chưa có ngưỡng trong Zone.thresholds nên trả undefined */
export function thresholdRange(key: MetricMeta['key'], t: Thresholds): string | undefined {
  switch (key) {
    case 'temperature': return `${t.temp_min}–${t.temp_max} °C`
    case 'humidity': return `${t.humidity_min}–${t.humidity_max} %`
    case 'light': return `< ${t.light_max} lux`
    case 'nh3': return `< ${t.nh3_max} ppm`
    case 'co2': return `< ${t.co2_max} ppm`
    default: return undefined
  }
}

/** Tra nhãn/đơn vị/số lẻ theo key — mọi nơi hiện 1 chỉ số (banner, card zone, drawer) định dạng giống nhau */
export const METRIC_BY_KEY = Object.fromEntries(ZONE_METRICS.map(m => [m.key, m])) as Record<MetricMeta['key'], MetricMeta>
