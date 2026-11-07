import type { Alert, AlertSeverity, AlertType } from '@/types'
import { getSeverityLevel, type SeverityLevel } from '@/utils/severity.utils'

// Bốn loại cảnh báo suy luận cần chuyên gia phán quyết — khớp INFERRED_ALERT_TYPES của backend (alert.service.ts)
export const INFERRED_ALERT_TYPES: readonly AlertType[] = [
  'NOISE_ANOMALY',
  'SENSOR_ANOMALY',
  'FORECAST_BREACH',
  'LOW_RETURN_RATE',
]

// Cảnh báo về thiết bị — khớp danh sách loại Technician được xem ở backend (alert.service.ts)
export const DEVICE_ALERT_TYPES: readonly AlertType[] = [
  'NODE_OFFLINE',
  'EDGE_AI_DEGRADED',
  'SENSOR_FAULT',
  'RS485_BUS_FAILURE',
  'UNEXPECTED_RESTART',
  'SPEAKER_FAILURE',
  'MISTING_INEFFECTIVE',
  'ACTUATOR_FAULT',
  'CONFIG_MISMATCH',
  'MAINTENANCE_DUE',
]

const SEVERITY_RANK: Record<AlertSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }

// Nhắc lại cảnh báo chưa ai xác nhận (ALERT-FR-015): CRITICAL/HIGH sau 15 phút, NODE_OFFLINE sau 1 giờ —
// khớp RENOTIFY_AFTER_MS, NODE_OFFLINE_RENOTIFY_AFTER_MS của backend
const RENOTIFY_AFTER_MS = 15 * 60 * 1000
const NODE_OFFLINE_RENOTIFY_AFTER_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

export type VerdictFilter = 'pending' | 'confirmed' | 'rejected'

export interface AlertFilter {
  // Nhà đang xem; null là mọi nhà của farm
  houseId: string | null
  // Các tầng của nhà đang xem: cảnh báo tầng không mang house_id nên lọc nhà theo tầng
  houseZoneIds: readonly string[]
  zoneId: string | null
  // Cấp hiển thị (Khẩn cấp · Cao · Thường), không phải 4 mức của backend
  severity: SeverityLevel | null
  type: AlertType | null
  verdict: VerdictFilter | null
}

export function isInferredAlert(alert: Pick<Alert, 'type'>): boolean {
  return INFERRED_ALERT_TYPES.includes(alert.type)
}

// Phán quyết chỉ có nghĩa với loại suy luận: đang lọc một loại khác thì bỏ lọc phán quyết — backend trả 400 cho cặp đó
// (listAlerts), và chuyên gia mặc định lọc "Chờ phán quyết" nên chọn loại nào cũng gặp
export function resolveVerdictFilter(type: AlertType | null, verdict: VerdictFilter | null): VerdictFilter | null {
  return type && !isInferredAlert({ type }) ? null : verdict
}

// Mốc thời gian gần nhất của cảnh báo: lần lặp gần nhất, chưa lặp thì lúc tạo
function getLatestTime(alert: Alert): string {
  return alert.last_seen_at ?? alert.created_at
}

// Thứ tự danh sách (đặc tả §2.5): mức nặng trước → chưa xác nhận trước đã xác nhận → mới nhất trước
export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((first, second) => {
    const bySeverity = SEVERITY_RANK[second.severity] - SEVERITY_RANK[first.severity]
    if (bySeverity !== 0) return bySeverity
    const byStatus = Number(second.status === 'ACTIVE') - Number(first.status === 'ACTIVE')
    if (byStatus !== 0) return byStatus
    return getLatestTime(second).localeCompare(getLatestTime(first))
  })
}

// Lọc trong app theo nhà, tầng, mức, loại, phán quyết. Phán quyết chỉ áp cho loại suy luận:
// đang lọc phán quyết thì loại khác bị bỏ, như GET /alerts?verdict của backend
export function filterAlerts(
  alerts: Alert[],
  filter: Omit<AlertFilter, 'severity'> & { severity?: SeverityLevel | null },
): Alert[] {
  const houseZoneIds = new Set(filter.houseZoneIds)
  return alerts.filter(alert => {
    if (filter.houseId && alert.house_id !== filter.houseId && !(alert.zone_id && houseZoneIds.has(alert.zone_id))) {
      return false
    }
    if (filter.zoneId && alert.zone_id !== filter.zoneId) return false
    if (filter.severity && getSeverityLevel(alert.severity) !== filter.severity) return false
    if (filter.type && alert.type !== filter.type) return false
    if (filter.verdict) {
      if (!isInferredAlert(alert)) return false
      const result = alert.expert_verdict?.result
      if (filter.verdict === 'pending' && result) return false
      if (filter.verdict === 'confirmed' && result !== 'CONFIRMED') return false
      if (filter.verdict === 'rejected' && result !== 'REJECTED') return false
    }
    return true
  })
}

// Bỏ cảnh báo trùng id khi ghép nhiều trang: backend chỉ sắp theo created_at nên các bản ghi cùng giờ tạo có thể nằm ở
// hai trang, và một cảnh báo đổi trạng thái giữa hai lần tải trang cũng có thể xuất hiện hai lần — trùng thì đếm sai
export function uniqueById(alerts: Alert[]): Alert[] {
  const seen = new Set<string>()
  return alerts.filter(alert => {
    if (seen.has(alert._id)) return false
    seen.add(alert._id)
    return true
  })
}

// Số cảnh báo theo từng cấp hiển thị (dải tóm tắt, đặc tả §2.2); CRITICAL và HIGH cùng tính vào Khẩn cấp
export function countBySeverityLevel(alerts: Alert[]): Record<SeverityLevel, number> {
  const counts: Record<SeverityLevel, number> = { P1: 0, P2: 0, P3: 0 }
  for (const alert of alerts) counts[getSeverityLevel(alert.severity)] += 1
  return counts
}

export type RenotifyState = { kind: 'countdown'; minutes: number } | { kind: 'sent' }

// Hàng cảnh báo hiện "Nhắc lại sau X phút" hoặc "Đã nhắc lại" (ALERT-FR-015); cảnh báo không được nhắc thì null
export function getRenotifyState(alert: Alert, now: number): RenotifyState | null {
  if (alert.status !== 'ACTIVE') return null
  const delay =
    alert.type === 'NODE_OFFLINE'
      ? NODE_OFFLINE_RENOTIFY_AFTER_MS
      : alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
        ? RENOTIFY_AFTER_MS
        : null
  if (delay === null) return null
  if (alert.renotified_at) return { kind: 'sent' }
  const remaining = Date.parse(alert.created_at) + delay - now
  return { kind: 'countdown', minutes: Math.max(0, Math.ceil(remaining / MINUTE_MS)) }
}

// ── Danh sách cảnh báo phân trang ở server (khi không lọc theo nhà) ─────────────────────────────────────────────────────

// Trạng thái của hai phần tab Cảnh báo, theo thứ tự hiện: chưa xác nhận trước đã xác nhận; đã hết trước bị bác bỏ
export const ACTIVE_ALERT_STATUSES: readonly Alert['status'][] = ['ACTIVE', 'ACKNOWLEDGED']
export const CLOSED_ALERT_STATUSES: readonly Alert['status'][] = ['RESOLVED', 'DISMISSED']

// Mức backend của từng cấp hiển thị, nặng trước
const LEVEL_SEVERITIES: Record<SeverityLevel, readonly AlertSeverity[]> = {
  P1: ['CRITICAL', 'HIGH'],
  P2: ['MEDIUM'],
  P3: ['LOW'],
}
export const ALERT_SEVERITIES: readonly AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

// Bộ lọc backend GET /alerts nhận được (farmId, zoneId, type, verdict); lọc nhà gồm cả tầng thì chưa (Known debt)
export interface ServerAlertFilter {
  // null: mọi farm người dùng được xem
  farmId: string | null
  zoneId: string | null
  type: AlertType | null
  verdict: VerdictFilter | null
}

// Một mắt của chuỗi trang: một trạng thái và (khi đang lọc cấp) một mức backend — backend chỉ nhận một giá trị mỗi tham số
export interface AlertChainLink {
  status: Alert['status']
  severity: AlertSeverity | null
}

// Chuỗi trang theo thứ tự hiện: từng trạng thái, trong đó từng mức của cấp đang lọc (không lọc thì mọi mức một lượt)
export function buildAlertChain(statuses: readonly Alert['status'][], level: SeverityLevel | null): AlertChainLink[] {
  const severities = level ? LEVEL_SEVERITIES[level] : [null]
  return statuses.flatMap(status => severities.map(severity => ({ status, severity })))
}

// Tham số GET /alerts của một mắt
export function toAlertQueryParams(
  filter: ServerAlertFilter,
  link: AlertChainLink,
  page: number,
  limit: number,
): Record<string, string> {
  return {
    ...(filter.farmId ? { farmId: filter.farmId } : {}),
    ...(filter.zoneId ? { zoneId: filter.zoneId } : {}),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.verdict ? { verdict: filter.verdict } : {}),
    status: link.status,
    ...(link.severity ? { severity: link.severity } : {}),
    page: String(page),
    limit: String(limit),
  }
}

// Vị trí trang trong chuỗi: mắt thứ mấy, trang thứ mấy của mắt đó
export interface AlertChainPageParam {
  link: number
  page: number
}

export interface AlertChainPage {
  link: number
  items: Alert[]
  // meta.total của mắt đó
  total: number
}

// Tải một trang của chuỗi. Mắt rỗng thì tự đi tiếp đến khi có dữ liệu hoặc hết chuỗi: danh sách rỗng không có gì để cuộn hay
// bấm "Xem thêm", nên dừng ở mắt rỗng sẽ hiện "Mọi thứ đang ổn" trong khi các mắt sau còn cảnh báo
export async function fetchAlertChainPage(
  chain: readonly AlertChainLink[],
  pageParam: AlertChainPageParam,
  fetchLinkPage: (link: AlertChainLink, page: number) => Promise<Pick<AlertChainPage, 'items' | 'total'>>,
): Promise<AlertChainPage> {
  const link = chain[pageParam.link]
  if (!link) return { link: pageParam.link, items: [], total: 0 }
  const result = await fetchLinkPage(link, pageParam.page)
  if (result.items.length > 0 || pageParam.link + 1 >= chain.length) return { link: pageParam.link, ...result }
  return fetchAlertChainPage(chain, { link: pageParam.link + 1, page: 1 }, fetchLinkPage)
}

// Trang kế tiếp theo meta.total: mắt hiện tại còn thì trang sau, hết thì sang mắt sau; hết chuỗi thì undefined
export function getNextAlertChainPage(
  chainLength: number,
  pages: readonly AlertChainPage[],
): AlertChainPageParam | undefined {
  const lastPage = pages[pages.length - 1]
  if (!lastPage) return { link: 0, page: 1 }
  const linkPages = pages.filter(page => page.link === lastPage.link)
  const loaded = linkPages.reduce((total, page) => total + page.items.length, 0)
  if (loaded < lastPage.total && lastPage.items.length > 0) return { link: lastPage.link, page: linkPages.length + 1 }
  return lastPage.link + 1 < chainLength ? { link: lastPage.link + 1, page: 1 } : undefined
}

// Số cảnh báo theo cấp từ meta.total của từng mức backend
export function sumLevelCounts(totals: Readonly<Record<AlertSeverity, number>>): Record<SeverityLevel, number> {
  const counts: Record<SeverityLevel, number> = { P1: 0, P2: 0, P3: 0 }
  for (const severity of ALERT_SEVERITIES) counts[getSeverityLevel(severity)] += totals[severity]
  return counts
}
