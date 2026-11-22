import type { ThresholdBreach } from '@/services/alert.service'

export type BreachMetric = 'temperature' | 'humidity' | 'light_lux' | 'nh3_ppm' | 'co2_ppm'

// nhiệt, ẩm chờ lâu hơn vì bộ mờ đang tác động
export const BREACH_DWELL_MS: Record<BreachMetric, number> = {
  temperature: 10 * 60_000,
  humidity:    10 * 60_000,
  light_lux:   5 * 60_000,
  nh3_ppm:     5 * 60_000,
  co2_ppm:     5 * 60_000,
}

export interface DwelledBreach extends ThresholdBreach { started_at: Date }

// In-memory theo process, restart thì đếm lại; nhiều instance thì chuyển Redis
const startedAt = new Map<string, number>()
const lastSampleAt = new Map<string, number>()

const DIRECTIONS: ThresholdBreach['direction'][] = ['above', 'below']

// Số đo trong ngưỡng cắt quãng chờ, thiếu số đo thì không cắt; im lặng quá maxGapMs thì đếm lại
export function trackBreachDwell(
  nodeId: string,
  readings: Partial<Record<BreachMetric, unknown>>,
  breaches: ThresholdBreach[],
  sampleTime: number,
  maxGapMs: number,
): { dwelled: DwelledBreach[]; ongoing: ThresholdBreach[] } {
  const previous = lastSampleAt.get(nodeId)
  if (previous !== undefined && sampleTime - previous > maxGapMs) {
    for (const key of startedAt.keys()) if (key.startsWith(`${nodeId}|`)) startedAt.delete(key)
  }
  // Mẫu lệch thứ tự không lùi mốc
  if (previous === undefined || sampleTime > previous) lastSampleAt.set(nodeId, sampleTime)

  for (const metric of Object.keys(BREACH_DWELL_MS) as BreachMetric[]) {
    const value = readings[metric]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    for (const direction of DIRECTIONS) {
      const key = `${nodeId}|${metric}|${direction}`
      const breached = breaches.some(b => b.metric === metric && b.direction === direction)
      if (!breached) startedAt.delete(key)
      else if (!startedAt.has(key)) startedAt.set(key, sampleTime)
    }
  }

  const dwelled = breaches.flatMap(b => {
    const start = startedAt.get(`${nodeId}|${b.metric}|${b.direction}`)
    const dwell = BREACH_DWELL_MS[b.metric as BreachMetric]
    return start !== undefined && dwell !== undefined && sampleTime - start >= dwell
      ? [{ ...b, started_at: new Date(start) }]
      : []
  })
  return { dwelled, ongoing: breaches }
}

// Cho test
export function clearBreachDwell(): void {
  startedAt.clear()
  lastSampleAt.clear()
}
