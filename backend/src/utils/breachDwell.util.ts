import type { ThresholdBreach } from '@/services/alert.service'

export type BreachMetric = 'temperature' | 'humidity' | 'light_lux' | 'nh3_ppm' | 'co2_ppm'

/**
 * BR-34 — thời gian 1 chỉ số phải ở ngoài ngưỡng liên tục trước khi tạo THRESHOLD_BREACH. Nhiệt độ,
 * độ ẩm lâu hơn vì bộ điều khiển mờ đang tác động lên chúng (Report 3 §4.5, hằng số kỹ thuật A-4).
 */
export const BREACH_DWELL_MS: Record<BreachMetric, number> = {
  temperature: 10 * 60_000,
  humidity:    10 * 60_000,
  light_lux:   5 * 60_000,
  nh3_ppm:     5 * 60_000,
  co2_ppm:     5 * 60_000,
}

export interface DwelledBreach extends ThresholdBreach { started_at: Date }

// ponytail: in-memory theo từng process như `lastPersisted` của telemetry — backend khởi động lại thì
// quãng chờ đếm lại từ đầu (cảnh báo chậm tối đa 1 lần thời gian chờ); chạy nhiều instance thì chuyển
// sang Redis.
const startedAt = new Map<string, number>()
/** Mẫu sống cuối của mỗi thiết bị — để biết thiết bị đã im lặng bao lâu trước mẫu này */
const lastSampleAt = new Map<string, number>()

const DIRECTIONS: ThresholdBreach['direction'][] = ['above', 'below']

/**
 * BR-34, ALERT-FR-012 — cập nhật quãng vượt ngưỡng của 1 thiết bị với 1 mẫu sống rồi trả:
 * - `dwelled`: các vượt ngưỡng đã ở ngoài ngưỡng đủ BREACH_DWELL_MS, kèm thời điểm bắt đầu;
 * - `ongoing`: mọi vượt ngưỡng của mẫu này (đủ thời gian chờ hay chưa).
 * Chỉ số có số đo nằm trong ngưỡng cắt quãng chờ của nó; chỉ số không có số đo (cảm biến lỗi, stale)
 * không bắt đầu cũng không cắt quãng chờ; đổi chiều (dưới → trên) đếm lại từ đầu.
 * Thiết bị im lặng lâu hơn `maxGapMs` (ngưỡng mất kết nối của BR-10) thì mọi quãng chờ của nó đếm lại
 * từ mẫu này: khoảng không có dữ liệu không được tính là "ở ngoài ngưỡng liên tục".
 */
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
  // Mẫu tới lệch thứ tự (sớm hơn mẫu trước) không lùi mốc
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

/** Xoá mọi quãng chờ — cho test */
export function clearBreachDwell(): void {
  startedAt.clear()
  lastSampleAt.clear()
}
