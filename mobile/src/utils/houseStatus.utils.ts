import type { Alert, CameraNode, RelayOverrideLog, SensorNode, Zone } from '@/types'
import { pickMostUrgentAlert, readThresholdBreaches } from '@/utils/alert.utils'
import { formatElapsed } from '@/utils/date.utils'
import { getAlertTypeShortLabel, getMetricShortLabel, getMetricUnit, getRelayShortLabel } from '@/utils/label.utils'
import { formatRemainingTime } from '@/utils/relay.utils'
import type { ThresholdMetric } from '@/utils/threshold.utils'
import { getCurrentLanguage, t } from '@/utils/i18n.utils'

// 7 trạng thái của một nhà, từ nặng đến nhẹ — mỗi nhà rơi vào đúng một trạng thái nặng nhất.
// SRS không có trạng thái cho cả nhà: các trạng thái này suy ra từ thiết bị và cảnh báo, KHÔNG phải trạng thái ngày MF-11.
// Không có trạng thái "dữ liệu cũ": Report 3 chưa có mốc thời gian nào cho việc đó (mốc kỹ thuật phải ghi ở §4.5 A-4)
const HOUSE_STATUS_ORDER = [
  'offline',
  'critical',
  'threshold',
  'attention',
  'setup',
  'manual',
  'ok',
] as const

export type HouseStatusKind = (typeof HOUSE_STATUS_ORDER)[number]

// Nơi mở tới khi chạm thẻ
export type HouseStatusTarget =
  | { screen: 'house-devices' }
  | { screen: 'alert'; alertId: string }
  | { screen: 'zone'; zoneId: string }
  | { screen: 'house-alerts' }
  | { screen: 'house' }
  | { screen: 'add-device' }

export interface HouseStatus {
  kind: HouseStatusKind
  // Thông điệp duy nhất ở dòng cuối thẻ
  message: string
  target: HouseStatusTarget
  // Chỉ số đang lệch — để chọn icon nhiệt kế hay giọt nước
  metric?: ThresholdMetric
}

export interface HouseStatusInput {
  zones: Zone[]
  sensorNodes: SensorNode[]
  cameraNodes: CameraNode[]
  // Cảnh báo chờ xác nhận (ACTIVE) của nhà
  activeAlerts: Alert[]
  // Relay đang bị ép tay, chưa kết thúc
  manualOverrides: RelayOverrideLog[]
}

const URGENT_SEVERITIES = new Set(['CRITICAL', 'HIGH'])

// Viết hoa chữ cái đầu câu
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// Số có dấu, dấu thập phân theo ngôn ngữ: tiếng Việt "+1,8", tiếng Anh "+1.8"; số âm dùng "−"
function formatSignedNumber(value: number): string {
  const rounded = String(Math.round(Math.abs(value) * 10) / 10)
  return `${value < 0 ? '−' : '+'}${getCurrentLanguage() === 'en' ? rounded : rounded.replace('.', ',')}`
}

// Thời điểm cũ nhất (mất kết nối lâu nhất) trong danh sách thiết bị offline
function pickLongestOffline<T extends { last_heartbeat?: string }>(nodes: T[]): T | undefined {
  return [...nodes].sort((first, second) => (first.last_heartbeat ?? '').localeCompare(second.last_heartbeat ?? ''))[0]
}

// Trạng thái nặng nhất của một nhà kèm thông điệp dòng cuối và nơi mở tới
export function getHouseStatus(input: HouseStatusInput, now: number = Date.now()): HouseStatus {
  const { zones, sensorNodes, cameraNodes, activeAlerts, manualOverrides } = input
  const zoneNameById = new Map(zones.map(zone => [zone._id, zone.name]))
  const prefixZone = (zoneId: string | undefined, text: string) => {
    const zoneName = zoneId ? zoneNameById.get(zoneId) : undefined
    return zoneName ? `${zoneName} ${text}` : capitalize(text)
  }

  // 1. Mất kết nối: controller trước, rồi camera AI
  const offlineSensor = pickLongestOffline(sensorNodes.filter(node => node.status === 'OFFLINE'))
  const offlineCamera = pickLongestOffline(cameraNodes.filter(node => node.status === 'OFFLINE'))
  const offlineNode = offlineSensor ?? offlineCamera
  if (offlineNode) {
    const subject = offlineSensor ? (zoneNameById.get(offlineSensor.zone_id) ?? 'Controller') : t('Camera AI')
    const message = offlineNode.last_heartbeat
      ? t('{subject} mất kết nối {duration}', {
          subject,
          duration: formatElapsed(now - new Date(offlineNode.last_heartbeat).getTime()),
        })
      : t('{subject} mất kết nối', { subject })
    return { kind: 'offline', message, target: { screen: 'house-devices' } }
  }

  // 2. Cảnh báo chờ xác nhận mức nghiêm trọng hoặc cao
  const urgentAlert = pickMostUrgentAlert(activeAlerts.filter(alert => URGENT_SEVERITIES.has(alert.severity)))
  if (urgentAlert) {
    return {
      kind: 'critical',
      message: prefixZone(urgentAlert.zone_id, getAlertTypeShortLabel(urgentAlert.type)),
      target: { screen: 'alert', alertId: urgentAlert._id },
    }
  }

  // 3. Vượt ngưỡng đang hiệu lực: chỉ số kèm độ lệch so với ngưỡng
  const thresholdAlert = activeAlerts.find(alert => alert.type === 'THRESHOLD_BREACH')
  if (thresholdAlert) {
    const [breach] = readThresholdBreaches(thresholdAlert.metadata)
    const detail = breach
      ? `${getMetricShortLabel(breach.metric)} ${formatSignedNumber(breach.value - breach.limit)}${getMetricUnit(breach.metric).trim()}`
      : getAlertTypeShortLabel('THRESHOLD_BREACH')
    return {
      kind: 'threshold',
      message: prefixZone(thresholdAlert.zone_id, detail),
      target: thresholdAlert.zone_id ? { screen: 'zone', zoneId: thresholdAlert.zone_id } : { screen: 'house' },
      metric: breach?.metric,
    }
  }

  // 4. Chỉ còn cảnh báo mức thấp: dự báo vượt ngưỡng, tỷ lệ về tổ giảm, bảo trì đến hạn…
  const attentionAlert = pickMostUrgentAlert(activeAlerts)
  if (attentionAlert) {
    return {
      kind: 'attention',
      message: prefixZone(attentionAlert.zone_id, getAlertTypeShortLabel(attentionAlert.type)),
      target: { screen: 'house-alerts' },
    }
  }

  // 5. Chưa hoàn tất thiết bị: chưa có thiết bị nào, hoặc thiết bị đăng ký quá 15 phút chưa kết nối
  if (sensorNodes.length === 0 && cameraNodes.length === 0) {
    return { kind: 'setup', message: t('Chưa có thiết bị'), target: { screen: 'add-device' } }
  }
  const isActivationOverdue = [...sensorNodes, ...cameraNodes].some(
    node => node.status === 'PENDING' && node.activation_overdue_at,
  )
  if (isActivationOverdue) {
    return { kind: 'setup', message: t('Thiết bị chưa kết nối'), target: { screen: 'add-device' } }
  }

  // 6. Relay đang chạy thủ công
  const [override] = manualOverrides
  if (override) {
    const action = override.state ? t('chạy thủ công') : t('tắt thủ công')
    const remaining = formatRemainingTime(override.expires_at, now) ?? t('đang trả về tự động')
    const subject = `${getRelayShortLabel(override.relay)} ${zoneNameById.get(override.zone_id) ?? ''}`.trim()
    return {
      kind: 'manual',
      message: `${subject} ${action}, ${remaining}`,
      target: { screen: 'zone', zoneId: override.zone_id },
    }
  }

  // 7. Ổn
  return { kind: 'ok', message: t('Tất cả trong ngưỡng'), target: { screen: 'house' } }
}

// Thứ hạng để xếp thẻ: nhà có vấn đề nặng hơn đứng trước
export function getHouseStatusRank(kind: HouseStatusKind): number {
  return HOUSE_STATUS_ORDER.indexOf(kind)
}
