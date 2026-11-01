import type { Alert, AlertType, RelayName } from '@/types'
import { readThresholdBreaches } from '@/utils/alert.utils'
import { getMetricLabel, getMetricUnit, getRelayLabel } from '@/utils/label.utils'
import { formatDecimal } from '@/utils/number.utils'
import type { SensorMetric } from '@/utils/threshold.utils'
import { t } from '@/utils/i18n.utils'

// Tên chỉ số trong metadata của backend → chỉ số của app
const BACKEND_METRICS: Record<string, SensorMetric> = {
  temperature: 'temperature',
  humidity: 'humidity',
  light_lux: 'light',
  light: 'light',
  nh3_ppm: 'nh3',
  co2_ppm: 'co2',
  sound_db: 'sound',
}

// Điều kiện tự đóng theo đúng code backend (alert.service, device.service, forecast, sensorAnomaly, birdCount)
const AUTO_CLOSE_TEXTS: Partial<Record<AlertType, string>> = {
  THRESHOLD_BREACH: 'Tự đóng khi số đo trở lại trong ngưỡng 5 phút',
  NOISE_ANOMALY: 'Tự đóng sau 60 phút không lặp lại',
  MISTING_INEFFECTIVE: 'Tự đóng sau 60 phút không lặp lại',
  NODE_OFFLINE: 'Tự đóng khi thiết bị kết nối lại',
  EDGE_AI_DEGRADED: 'Tự đóng khi camera kết nối lại',
  FORECAST_BREACH: 'Tự đóng khi dự báo không còn vượt ngưỡng',
  SENSOR_ANOMALY: 'Tự đóng khi dữ liệu cảm biến bình thường lại',
  LOW_RETURN_RATE: 'Tự đóng khi tỉ lệ về tổ trở lại trong giới hạn',
  MAINTENANCE_DUE: 'Đóng khi chủ trại xác nhận đã bảo trì (bộ đếm giờ chạy về 0)',
}

const ANOMALY_KIND_LABELS: Record<string, string> = {
  STUCK: 'Số đứng yên',
  SPIKE: 'Số nhảy vọt',
  DRIFT: 'Lệch giữa các thiết bị',
}

// Câu tự đóng của một loại; backend không tự đóng thì nói đóng khi sự cố được xử lý
export function getAutoCloseText(type: AlertType): string {
  return t(AUTO_CLOSE_TEXTS[type] ?? 'Đóng khi sự cố được xử lý')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// Số kèm đơn vị của một chỉ số, số lẻ gọn
function formatMetricValue(metric: SensorMetric, value: number): string {
  return `${formatDecimal(value, Number.isInteger(value) ? 0 : 1)}${getMetricUnit(metric)}`
}

// Nội dung riêng theo loại trong chi tiết (đặc tả §4) — chỉ từ metadata backend thật sự gửi; không có thì mảng rỗng
export function describeAlertDetail(alert: Alert): string[] {
  const metadata = alert.metadata
  const lines: string[] = []

  if (alert.type === 'THRESHOLD_BREACH') {
    for (const breach of readThresholdBreaches(metadata)) {
      const metricName = getMetricLabel(breach.metric)
      const value = formatMetricValue(breach.metric, breach.value)
      const limit = formatMetricValue(breach.metric, breach.limit)
      lines.push(
        breach.direction === 'below'
          ? t('{metric} {value}, dưới ngưỡng {limit}', { metric: metricName, value, limit })
          : t('{metric} {value}, vượt ngưỡng {limit}', { metric: metricName, value, limit }),
      )
      if (breach.metric === 'nh3' || breach.metric === 'co2') {
        lines.push(t('{metric}: giới hạn cảnh báo, không điều khiển quạt', { metric: metricName }))
      }
    }
  }

  if (alert.type === 'FORECAST_BREACH') {
    const predicted = asRecord(metadata?.predicted)
    const metric = BACKEND_METRICS[String(predicted?.metric)]
    const value = asNumber(predicted?.value)
    const limit = asNumber(predicted?.limit)
    const minutes = asNumber(predicted?.minutesAhead)
    if (metric && value !== null && limit !== null && minutes !== null) {
      lines.push(
        t('Dự kiến {metric} {value} sau {minutes} phút, {direction} ngưỡng {limit}', {
          metric: getMetricLabel(metric),
          value: formatMetricValue(metric, value),
          minutes,
          direction: predicted?.direction === 'below' ? t('dưới') : t('vượt'),
          limit: formatMetricValue(metric, limit),
        }),
      )
    }
  }

  if (alert.type === 'SENSOR_ANOMALY') {
    const findings = Array.isArray(metadata?.findings) ? metadata.findings : []
    for (const finding of findings) {
      const record = asRecord(finding)
      if (!record) continue
      const metric = BACKEND_METRICS[String(record.metric)]
      const kind = t(ANOMALY_KIND_LABELS[String(record.kind)] ?? 'Bất thường')
      const detail = typeof record.detail === 'string' ? `: ${record.detail}` : ''
      lines.push(`${kind}${metric ? ` · ${getMetricLabel(metric)}` : ''}${detail}`)
    }
  }

  if (alert.type === 'UNEXPECTED_RESTART' && typeof metadata?.reset_reason === 'string') {
    lines.push(t('Lý do khởi động lại: {reason}', { reason: metadata.reset_reason }))
  }

  if (alert.type === 'MAINTENANCE_DUE') {
    const loads = Array.isArray(metadata?.loads) ? metadata.loads : []
    for (const load of loads) {
      const record = asRecord(load)
      const relay = record?.relay
      const hours = asNumber(record?.hours)
      const switches = asNumber(record?.switches)
      if (!record || typeof relay !== 'string' || hours === null || switches === null) continue
      lines.push(
        t('{relay}: {hours} giờ chạy (giới hạn {limitHours}), {switches} lần đóng ngắt (giới hạn {limitSwitches})', {
          relay: getRelayLabel(relay as RelayName),
          hours: formatDecimal(hours, 1),
          limitHours: asNumber(record.limit_hours) === null ? '_' : formatDecimal(record.limit_hours as number),
          switches: formatDecimal(switches),
          limitSwitches:
            asNumber(record.limit_switches) === null ? '_' : formatDecimal(record.limit_switches as number),
        }),
      )
    }
  }

  if (alert.type === 'LOW_RETURN_RATE') {
    const rate = asNumber(metadata?.returnRate)
    const average = asNumber(metadata?.avg)
    const drop = asNumber(metadata?.dropPct)
    const limit = asNumber(metadata?.limit)
    if (rate !== null && average !== null) {
      lines.push(
        t('Ngày {date}: tỉ lệ về tổ {rate}%, trung bình các ngày trước {average}%', {
          date: typeof metadata?.sessionDate === 'string' ? metadata.sessionDate : '_',
          rate: formatDecimal(rate, 1),
          average: formatDecimal(average, 1),
        }),
      )
    }
    if (drop !== null && limit !== null) {
      lines.push(
        t('Giảm {drop}%, giới hạn cho phép {limit}%', { drop: formatDecimal(drop, 1), limit: formatDecimal(limit, 1) }),
      )
    }
  }

  return lines
}

// Cảnh báo môi trường: chủ trại có thể mở điều khiển tay của tầng (ENV-FR-016)
export function isEnvironmentAlert(alert: Pick<Alert, 'type' | 'zone_id'>): boolean {
  return Boolean(alert.zone_id) && ['THRESHOLD_BREACH', 'FORECAST_BREACH', 'MISTING_INEFFECTIVE'].includes(alert.type)
}
