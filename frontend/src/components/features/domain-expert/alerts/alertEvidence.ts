/**
 * alertEvidence.ts — Dynamic evidence config builder for MultimodalEvidenceCharts
 * SRS v2.1.4: EXPERT-FR-003, ALERT-FR-014
 * Chuyển đổi telemetry.samples và bird_counts.buckets từ GET /alerts/{id}/evidence
 * thành dữ liệu đồ thị thực tế (tuyệt đối không dùng số cứng giả lập)
 */
import type { AlertEvidence, BirdCountBucket, InferredAlertItem, TelemetrySample } from '@/types/expert.types'
import { formatHM } from '@/lib/helpers'

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

  // 1. NOISE_ANOMALY — nguồn âm thanh
  if (alert.type === 'NOISE_ANOMALY') {
    const validSamples = samples.filter(s => typeof s.sound_db === 'number' && Number.isFinite(s.sound_db))
    if (validSamples.length === 0) return null

    const soundValues = validSamples.map(s => Number(s.sound_db))
    const maxSound = Math.max(...soundValues)
    const minSound = Math.min(...soundValues)
    const peakSample = validSamples.find(s => Number(s.sound_db) === maxSound)

    const metaSound = typeof alert.metadata?.sound_db === 'number' ? alert.metadata.sound_db : maxSound
    const noiseMargin = typeof alert.metadata?.noise_margin === 'number' ? alert.metadata.noise_margin : 7.5
    const refY = Math.round((metaSound - noiseMargin) * 10) / 10
    const topDomain = Math.max(80, Math.ceil((maxSound + 10) / 10) * 10)
    const bottomDomain = Math.max(0, Math.floor((minSound - 10) / 10) * 10)

    const data: EvidenceBarPoint[] = validSamples.map(s => {
      const val = Number(s.sound_db)
      const isAnomaly = val >= refY || val >= maxSound - 0.1
      return {
        time: safeFormatHM(s.timestamp),
        value: val,
        isAnomaly,
      }
    })

    const peakTime = safeFormatHM(peakSample?.timestamp ?? alert.created_at)

    return {
      title: 'Nguồn 1: Cảm biến Âm thanh (Telemetry thực tế)',
      badge1: `Số mẫu: ${validSamples.length}`,
      badge2: `Ngưỡng: ${refY} dB`,
      highlight: `Đỉnh: ${maxSound} dB`,
      unit: ' dB',
      domain: [bottomDomain, topDomain],
      ticks: generateTicks(bottomDomain, topDomain, 5),
      refY,
      refLabel: `${refY} dB`,
      data,
      anomalyTag: `${peakTime} — ${maxSound} dB (vượt ngưỡng ${refY} dB)`,
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
  let titleMetric = 'Độ ẩm'

  if (isTemp) {
    key = 'temperature'
    unit = ' °C'
    titleMetric = 'Nhiệt độ'
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
    title: `Nguồn 1: Cảm biến ${titleMetric} (Telemetry thực tế)`,
    badge1: `Số mẫu: ${validSamples.length}`,
    badge2: `Khoảng: ${minVal} – ${maxVal}${unit}`,
    highlight: `Lệch đỉnh: ${peakVal}${unit}`,
    unit,
    domain: [domainMin, domainMax],
    ticks: generateTicks(domainMin, domainMax, 5),
    refY: Math.round(avgVal * 10) / 10,
    refLabel: `TB: ${(Math.round(avgVal * 10) / 10)}${unit}`,
    data,
    anomalyTag: `${peakTime} — ${peakVal}${unit} (lệch ${maxDev.toFixed(1)}${unit} so với TB)`,
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
    title: 'Nguồn 2: Camera AI chim Ra/Vào (Buckets 5 phút)',
    badge1: `Chim vào: ${totalEntry} con`,
    badge2: `Chim ra: ${totalExit} con`,
    highlight: `Tại mốc: ${closestBucket.entry_count} vào`,
    unit: ' con',
    domain: [0, domainMax],
    ticks: generateTicks(0, domainMax, 5),
    refY: Math.round(avgEntry),
    refLabel: `TB: ${Math.round(avgEntry)}`,
    data,
    anomalyTag: `${closestTime} — ${closestBucket.entry_count} vào / ${closestBucket.exit_count} ra`,
    barColor: '#8BAF2A',
  }
}

export function buildAlertEvidence(
  alert: InferredAlertItem,
  evidence?: AlertEvidence | null
): AlertEvidenceConfig {
  let windowLabel = ''
  if (evidence?.window?.from && evidence?.window?.to) {
    windowLabel = `Khung giờ ±30 phút (${safeFormatHM(evidence.window.from)} – ${safeFormatHM(evidence.window.to)})`
  } else {
    const d = new Date(alert.created_at)
    const baseTime = isNaN(d.getTime()) ? new Date() : d
    const from = new Date(baseTime.getTime() - 30 * 60_000)
    const to = new Date(baseTime.getTime() + 30 * 60_000)
    windowLabel = `Khung giờ ±30 phút (${safeFormatHM(from)} – ${safeFormatHM(to)})`
  }

  const src1 = buildTelemetryEvidenceSource(alert, evidence?.telemetry?.samples)
  const src2 = buildBirdCountEvidenceSource(alert, evidence?.bird_counts?.buckets)

  let correlation = ''
  if (alert.type === 'NOISE_ANOMALY') {
    if (src1 && src2) {
      correlation = `Cảm biến âm thanh ghi nhận ${src1.highlight} tại thời điểm cảnh báo; chuỗi đếm chim ghi nhận tổng ${src2.badge1} và ${src2.badge2} trong cửa sổ ±30 phút → Dữ liệu thực tế đối chiếu giữa âm thanh và phản ứng đàn chim.`
    } else if (src1) {
      correlation = `Cảm biến âm thanh ghi nhận ${src1.badge1} với ${src1.highlight}. Camera AI không có dữ liệu chuỗi đếm chim trong khung giờ này (trạng thái missing).`
    } else if (src2) {
      correlation = `Thiếu dữ liệu telemetry âm thanh (trạng thái missing). Chuỗi đếm chim ghi nhận ${src2.badge1}, ${src2.badge2}.`
    } else {
      correlation = `Không có dữ liệu đo đạc telemetry và đếm chim trong khung giờ ±30 phút (trạng thái missing). ${alert.message}`
    }
  } else if (alert.type === 'SENSOR_ANOMALY') {
    if (src1) {
      correlation = `Chuỗi đo telemetry ghi nhận ${src1.badge1} quanh mốc cảnh báo (${src1.badge2}). ${src1.anomalyTag}.`
    } else {
      correlation = `Không có mẫu đo telemetry trong khung giờ ±30 phút để đối chiếu cảm biến (trạng thái missing). ${alert.message}`
    }
  } else if (alert.type === 'FORECAST_BREACH') {
    if (src1) {
      correlation = `Dữ liệu đo đạc thực tế gồm ${src1.badge1} trong cửa sổ ±30 phút quanh thời điểm phát cảnh báo dự báo vi phạm ngưỡng.`
    } else {
      correlation = `Không có dữ liệu đo đạc thực tế trong khung giờ ±30 phút quanh cảnh báo dự báo (trạng thái missing).`
    }
  } else {
    correlation = alert.message || 'Hệ thống trình bày dữ liệu đối chiếu quanh thời điểm phát sinh sự cố để chuyên gia thẩm định.'
  }

  return {
    windowLabel,
    src1,
    src2,
    correlation,
  }
}
