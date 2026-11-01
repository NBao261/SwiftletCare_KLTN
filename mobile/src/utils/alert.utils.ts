import { PUMP_ON_CONFIRM_ALERT_TYPES } from '@/constants/relayOverride'
import type { Alert, AlertSeverity } from '@/types'
import { getMetricLabel, getMetricUnit } from '@/utils/label.utils'
import type { ThresholdMetric } from '@/utils/threshold.utils'
import { t } from '@/utils/i18n.utils'

// Thứ hạng mức độ: số càng lớn càng khẩn
const SEVERITY_RANK: Record<AlertSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
}

// Tên chỉ số trong metadata.breaches của backend (alert.service findThresholdBreaches) → tên chỉ số của app
const BACKEND_METRIC_KEYS: Record<string, ThresholdMetric> = {
  temperature: 'temperature',
  humidity: 'humidity',
  light_lux: 'light',
  nh3_ppm: 'nh3',
  co2_ppm: 'co2',
}

export interface ThresholdBreachDetail {
  metric: ThresholdMetric
  value: number
  limit: number
  direction: 'above' | 'below'
}

// Cảnh báo khẩn nhất: mức độ cao nhất, cùng mức thì mới nhất; danh sách rỗng thì null
export function pickMostUrgentAlert(alerts: Alert[]): Alert | null {
  let mostUrgent: Alert | null = null
  for (const alert of alerts) {
    if (!mostUrgent) {
      mostUrgent = alert
      continue
    }
    const rankDifference = SEVERITY_RANK[alert.severity] - SEVERITY_RANK[mostUrgent.severity]
    // Chuỗi ISO so sánh được theo thứ tự thời gian
    if (rankDifference > 0 || (rankDifference === 0 && alert.created_at > mostUrgent.created_at)) mostUrgent = alert
  }
  return mostUrgent
}

// Đọc metadata.breaches của cảnh báo vượt ngưỡng; dòng nào sai dạng thì bỏ qua
export function readThresholdBreaches(metadata: Alert['metadata']): ThresholdBreachDetail[] {
  const breaches = metadata?.breaches
  if (!Array.isArray(breaches)) return []
  return breaches.flatMap(breach => {
    const metric = BACKEND_METRIC_KEYS[String(breach?.metric)]
    const isValid = metric && typeof breach.value === 'number' && typeof breach.limit === 'number'
    return isValid ? [{ metric, value: breach.value, limit: breach.limit, direction: breach.direction }] : []
  })
}

// Câu chính một dòng: "Nhiệt độ Tầng 1: 36.2°C (Vượt ngưỡng 35°C)"; không có số liệu ngưỡng thì dùng tiêu đề backend
export function getAlertHeadline(alert: Alert, locationName?: string): string {
  const [firstBreach, ...otherBreaches] = readThresholdBreaches(alert.metadata)
  if (!firstBreach) return alert.title

  const unit = getMetricUnit(firstBreach.metric)
  const place = locationName ? ` ${locationName}` : ''
  const otherText = otherBreaches.length > 0 ? t(' +{count} chỉ số', { count: otherBreaches.length }) : ''
  const template =
    firstBreach.direction === 'below'
      ? '{metric}{place}: {value}{unit} (Dưới ngưỡng {limit}{unit})'
      : '{metric}{place}: {value}{unit} (Vượt ngưỡng {limit}{unit})'
  const metric = getMetricLabel(firstBreach.metric)
  return t(template, { metric, place, value: firstBreach.value, unit, limit: firstBreach.limit }) + otherText
}

// Mức cao nhất trong các cảnh báo; không có cảnh báo thì null
export function getHighestSeverity(alerts: Alert[]): AlertSeverity | null {
  return pickMostUrgentAlert(alerts)?.severity ?? null
}

// Số phút tới lúc dự báo vượt ngưỡng của một chỉ số (FORECAST_BREACH, ALERT-FR-011, metadata.predicted của backend);
// nhiều cảnh báo thì lấy mốc sớm nhất, không có thì null
export function getForecastMinutesAhead(alerts: Alert[], metric: 'temperature' | 'humidity'): number | null {
  let earliest: number | null = null
  for (const alert of alerts) {
    if (alert.type !== 'FORECAST_BREACH') continue
    const predicted = alert.metadata?.predicted
    if (typeof predicted !== 'object' || predicted === null) continue
    const { metric: predictedMetric, minutesAhead } = predicted as Record<string, unknown>
    if (predictedMetric !== metric || typeof minutesAhead !== 'number') continue
    if (earliest === null || minutesAhead < earliest) earliest = minutesAhead
  }
  return earliest
}

// Cảnh báo đang mở khiến việc bật bơm phải được xác nhận (ENV-FR-016)
export function getPumpOnBlockingAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter(alert => PUMP_ON_CONFIRM_ALERT_TYPES.includes(alert.type))
}
