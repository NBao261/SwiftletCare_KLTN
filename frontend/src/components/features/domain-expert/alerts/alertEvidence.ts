// Dựng dữ liệu biểu đồ từ samples và buckets của GET /alerts/:id/evidence
import type { AlertEvidence, BirdCountBucket, InferredAlertItem, TelemetrySample } from '@/types/expert.types'
import { formatHM } from '@/lib/helpers'
import { t } from '@/i18n'

export interface EvidenceBarPoint {
  time: string
  value: number
  isAnomaly: boolean
}

export interface EvidenceSource {
  title: string
  badge1: string
  badge2: string
  highlight?: string
  unit: string
  domain: [number, number]
  ticks: number[]
  refY?: number
  refLabel?: string
  data: EvidenceBarPoint[]
  anomalyTag: string
  barColor?: string
}

export interface AlertEvidenceConfig {
  windowLabel: string
  src1: EvidenceSource | null
  src2: EvidenceSource | null
  correlation: string
}

export function safeFormatHM(date: string | Date | undefined): string {
  if (!date) return '--:--'
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return '--:--'
    return formatHM(d)
  } catch {
    return '--:--'
  }
}

export function generateTicks(min: number, max: number, count = 5): number[] {
  if (min >= max) return [min, min + 1]
  const step = Math.ceil((max - min) / (count - 1))
  const ticks: number[] = []
  for (let i = 0; i < count; i++) {
    ticks.push(Math.round(min + i * step))
  }
  return Array.from(new Set(ticks))
}

export function buildTelemetryEvidenceSource(
  alert: InferredAlertItem,
  samples?: TelemetrySample[] | null
): EvidenceSource | null {
  if (!samples || samples.length === 0) return null

  // 1. NOISE_ANOMALY: nguồn âm thanh
  if (alert.type === 'NOISE_ANOMALY') {
    const validSamples = samples.filter(s => typeof s.sound_db === 'number' && Number.isFinite(s.sound_db))
    if (validSamples.length === 0) return null

    const soundValues = validSamples.map(s => Number(s.sound_db))
    const maxSound = Math.max(...soundValues)
    const minSound = Math.min(...soundValues)
    const avgSound = Math.round((soundValues.reduce((sum, v) => sum + v, 0) / soundValues.length) * 10) / 10
    const peakSample = validSamples.find(s => Number(s.sound_db) === maxSound)

    const topDomain = Math.max(80, Math.ceil((maxSound + 10) / 10) * 10)
    const bottomDomain = Math.max(0, Math.floor((minSound - 10) / 10) * 10)

    const data: EvidenceBarPoint[] = validSamples.map(s => {
      const val = Number(s.sound_db)
      const isAnomaly = val === maxSound || (maxSound > avgSound && val >= maxSound - 0.1)
      return {
        time: safeFormatHM(s.timestamp),
        value: val,
        isAnomaly,
      }
    })

    const peakTime = safeFormatHM(peakSample?.timestamp ?? alert.created_at)

    return {
      title: t('Cảm biến âm thanh'),
      badge1: t('Số mẫu: {{n}}', { n: validSamples.length }),
      badge2: t('Trung bình: {{value}} dB', { value: avgSound }),
      highlight: t('Đỉnh: {{value}} dB', { value: maxSound }),
      unit: ' dB',
      domain: [bottomDomain, topDomain],
      ticks: generateTicks(bottomDomain, topDomain, 5),
      refY: avgSound,
      refLabel: t('Trung bình: {{value}}', { value: `${avgSound} dB` }),
      data,
      anomalyTag: `${peakTime} · ${maxSound} dB (${t('đỉnh đo được trong khung giờ')})`,
    }
  }

  // 2. SENSOR_ANOMALY hoặc FORECAST_BREACH
  const m = alert.metadata ?? {}
  const metricKey = String(m.metric || m.sensor_type || '').toLowerCase()
  const isTemp = metricKey.includes('temp') || metricKey.includes('nhiệt')
  const isCo2 = metricKey.includes('co2')
  const isNh3 = metricKey.includes('nh3')

  let key: keyof TelemetrySample = 'humidity'
  let unit = ' %'
  let titleMetric = t('độ ẩm')

  if (isTemp) {
    key = 'temperature'
    unit = ' °C'
    titleMetric = t('nhiệt độ')
  } else if (isCo2) {
    key = 'co2_ppm'
    unit = ' ppm'
    titleMetric = 'CO2'
  } else if (isNh3) {
    key = 'nh3_ppm'
    unit = ' ppm'
    titleMetric = 'NH3'
  }

  const validSamples = samples.filter(s => typeof s[key] === 'number' && Number.isFinite(s[key] as number))
  if (validSamples.length === 0) return null

  const values = validSamples.map(s => Number(s[key]))
  const maxVal = Math.max(...values)
  const minVal = Math.min(...values)
  const avgVal = values.reduce((sum, v) => sum + v, 0) / values.length

  let maxDev = -1
  let peakSample = validSamples[0]
  for (const s of validSamples) {
    const dev = Math.abs(Number(s[key]) - avgVal)
    if (dev > maxDev) {
      maxDev = dev
      peakSample = s
    }
  }

  const peakVal = Number(peakSample?.[key] ?? maxVal)
  const peakTime = safeFormatHM(peakSample?.timestamp ?? alert.created_at)

  let domainMin = Math.max(0, Math.floor(minVal - 5))
  let domainMax = Math.ceil(maxVal + 5)
  if (key === 'humidity') {
    domainMin = 0
    domainMax = 100
  }

  const data: EvidenceBarPoint[] = validSamples.map(s => {
    const val = Number(s[key])
    const isAnomaly = s === peakSample || Math.abs(val - avgVal) >= Math.max(maxDev * 0.8, 1)
    return {
      time: safeFormatHM(s.timestamp),
      value: val,
      isAnomaly,
    }
  })

  return {
    title: t('Cảm biến {{metric}}', { metric: titleMetric }),
    badge1: t('Số mẫu: {{n}}', { n: validSamples.length }),
    badge2: t('Khoảng: {{value}}', { value: `${minVal} – ${maxVal}${unit}` }),
    highlight: t('Lệch đỉnh: {{value}}', { value: `${peakVal}${unit}` }),
    unit,
    domain: [domainMin, domainMax],
    ticks: generateTicks(domainMin, domainMax, 5),
    refY: Math.round(avgVal * 10) / 10,
    refLabel: t('Trung bình: {{value}}', { value: `${Math.round(avgVal * 10) / 10}${unit}` }),
    data,
    anomalyTag: `${peakTime} · ${peakVal}${unit} (${t('lệch {{value}} so với trung bình', { value: `${maxDev.toFixed(1)}${unit}` })})`,
  }
}

export function buildBirdCountEvidenceSource(
  alert: InferredAlertItem,
  buckets?: BirdCountBucket[] | null
): EvidenceSource | null {
  if (!buckets || buckets.length === 0) return null

  const validBuckets = buckets.filter(b => typeof b.entry_count === 'number' && Number.isFinite(b.entry_count))
  if (validBuckets.length === 0) return null

  const totalEntry = validBuckets.reduce((sum, b) => sum + (b.entry_count || 0), 0)
  const totalExit = validBuckets.reduce((sum, b) => sum + (b.exit_count || 0), 0)
  const entryValues = validBuckets.map(b => b.entry_count)
  const maxEntry = Math.max(...entryValues, 5)
  const avgEntry = totalEntry / validBuckets.length

  const alertTime = new Date(alert.created_at).getTime()
  let closestBucket = validBuckets[0]
  let minDiff = Infinity
  for (const b of validBuckets) {
    const diff = Math.abs(new Date(b.bucket_start).getTime() - alertTime)
    if (diff < minDiff) {
      minDiff = diff
      closestBucket = b
    }
  }

  const domainMax = Math.max(10, Math.ceil(maxEntry * 1.25))

  const data: EvidenceBarPoint[] = validBuckets.map(b => ({
    time: safeFormatHM(b.bucket_start),
    value: b.entry_count,
    isAnomaly: b === closestBucket && b.entry_count < avgEntry,
  }))

  const closestTime = safeFormatHM(closestBucket.bucket_start)

  return {
    title: t('Số chim ra, vào (mỗi 5 phút)'),
    badge1: t('Chim vào: {{n}} con', { n: totalEntry }),
    badge2: t('Chim ra: {{n}} con', { n: totalExit }),
    highlight: t('Tại mốc: {{n}} vào', { n: closestBucket.entry_count }),
    unit: ` ${t('con')}`,
    domain: [0, domainMax],
    ticks: generateTicks(0, domainMax, 5),
    refY: Math.round(avgEntry),
    refLabel: t('Trung bình: {{value}}', { value: Math.round(avgEntry) }),
    data,
    anomalyTag: `${closestTime} · ${t('{{in}} vào / {{out}} ra', { in: closestBucket.entry_count, out: closestBucket.exit_count })}`,
    barColor: '#8BAF2A',
  }
}

export function buildAlertEvidence(
  alert: InferredAlertItem,
  evidence?: AlertEvidence | null
): AlertEvidenceConfig {
  let windowLabel = ''
  if (evidence?.window?.from && evidence?.window?.to) {
    windowLabel = t('Khung giờ ±30 phút ({{from}} – {{to}})', { from: safeFormatHM(evidence.window.from), to: safeFormatHM(evidence.window.to) })
  } else {
    const d = new Date(alert.created_at)
    const baseTime = isNaN(d.getTime()) ? new Date() : d
    const from = new Date(baseTime.getTime() - 30 * 60_000)
    const to = new Date(baseTime.getTime() + 30 * 60_000)
    windowLabel = t('Khung giờ ±30 phút ({{from}} – {{to}})', { from: safeFormatHM(from), to: safeFormatHM(to) })
  }

  const src1 = buildTelemetryEvidenceSource(alert, evidence?.telemetry?.samples)
  const src2 = buildBirdCountEvidenceSource(alert, evidence?.bird_counts?.buckets)

  let correlation = ''
  if (alert.type === 'NOISE_ANOMALY') {
    if (src1 && src2) {
      correlation = t('Cảm biến âm thanh ghi nhận {{peak}} lúc cảnh báo; số chim trong ±30 phút: {{entry}}, {{exit}}. Đối chiếu âm thanh với phản ứng của đàn chim.', { peak: src1.highlight, entry: src2.badge1, exit: src2.badge2 })
    } else if (src1) {
      correlation = t('Cảm biến âm thanh ghi nhận {{samples}}, {{peak}}. Không có số chim đếm trong khung giờ này.', { samples: src1.badge1, peak: src1.highlight })
    } else if (src2) {
      correlation = t('Không có số đo âm thanh. Số chim đếm được: {{entry}}, {{exit}}.', { entry: src2.badge1, exit: src2.badge2 })
    } else {
      correlation = `${t('Không có số đo và số chim đếm trong khung giờ ±30 phút.')} ${alert.message}`
    }
  } else if (alert.type === 'SENSOR_ANOMALY') {
    if (src1) {
      correlation = `${t('Có {{samples}} quanh mốc cảnh báo ({{range}}).', { samples: src1.badge1, range: src1.badge2 })} ${src1.anomalyTag}.`
    } else {
      correlation = `${t('Không có số đo trong khung giờ ±30 phút để đối chiếu cảm biến.')} ${alert.message}`
    }
  } else if (alert.type === 'FORECAST_BREACH') {
    if (src1) {
      correlation = t('Có {{samples}} trong ±30 phút quanh lúc phát cảnh báo dự báo vượt ngưỡng.', { samples: src1.badge1 })
    } else {
      correlation = t('Không có số đo trong khung giờ ±30 phút quanh cảnh báo dự báo.')
    }
  } else {
    correlation = alert.message || t('Số liệu quanh thời điểm có cảnh báo để chuyên gia kiểm chứng.')
  }

  return {
    windowLabel,
    src1,
    src2,
    correlation,
  }
}
