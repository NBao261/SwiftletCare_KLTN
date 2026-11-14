import type { ChecklistItem, MaintenancePlan, SensorNode, Zone } from '@/types'
import { getVietnamDate } from '@/utils/date.utils'
import { formatMaintenanceInterval } from '@/utils/label.utils'
import { formatDecimal } from '@/utils/number.utils'
import { t } from '@/utils/i18n.utils'

export interface ChecklistProgress {
  done: number
  total: number
  defects: number
  // Mọi mục đã có kết quả: backend mới cho báo xong (BR-41, thiếu → 422)
  isComplete: boolean
}

// Tiến độ checklist của Work Order phòng ngừa (OPS-FR-007); Work Order sửa chữa không có checklist thì coi như đủ
export function getChecklistProgress(checklist: readonly ChecklistItem[] | undefined): ChecklistProgress {
  const items = checklist ?? []
  let done = 0
  let defects = 0
  for (const item of items) {
    if (item.result == null) continue
    done += 1
    if (item.result === 'DEFECT') defects += 1
  }
  return { done, total: items.length, defects, isComplete: done === items.length }
}

// Mức đã dùng của kế hoạch theo giờ chạy hoặc số lần đóng cắt: số lớn nhất trong các controller của nhà (BR-45, bơm = relay
// misting, quạt = relay ventilation), tính từ lần bảo trì trước. Kế hoạch theo lịch, hoặc chưa có số đếm, thì null
export function getPlanUsage(
  plan: Pick<MaintenancePlan, 'equipment' | 'basis' | 'house_id'>,
  sensorNodes: readonly SensorNode[],
  zoneById: ReadonlyMap<string, Pick<Zone, 'house_id'>>,
): { used: number } | null {
  if (plan.basis === 'CALENDAR') return null
  const relay = plan.equipment === 'PUMP' ? 'misting' : plan.equipment === 'FAN' ? 'ventilation' : null
  if (!relay) return null
  let used: number | null = null
  for (const node of sensorNodes) {
    if (zoneById.get(node.zone_id)?.house_id !== plan.house_id) continue
    const usage = node.relay_usage?.[relay]
    const value = plan.basis === 'RUN_HOURS' ? usage?.since_service_hours : usage?.since_service_switches
    if (value === undefined) continue
    used = used === null ? value : Math.max(used, value)
  }
  return used === null ? null : { used }
}

// Thứ tự trạng thái khi xếp danh sách kế hoạch: quá hạn, đến hạn, theo lịch, đã bỏ
const STATE_ORDER: Record<MaintenancePlan['state'], number> = { OVERDUE: 0, DUE: 1, SCHEDULED: 2, RETIRED: 3 }

// Kế hoạch cần làm trước lên đầu, cùng trạng thái thì giữ thứ tự backend trả
export function sortPlansByUrgency(plans: readonly MaintenancePlan[]): MaintenancePlan[] {
  return [...plans].sort((first, second) => STATE_ORDER[first.state] - STATE_ORDER[second.state])
}

// Ngày theo giờ Việt Nam dạng DD/MM/YYYY — không phụ thuộc múi giờ của máy
export function formatMaintenanceDate(isoDate: string): string {
  const [year, month, day] = getVietnamDate(Date.parse(isoDate)).split('-')
  return `${day}/${month}/${year}`
}

// Một dòng tiến độ của kế hoạch: theo giờ chạy / số lần đóng cắt thì mức đã dùng trên chu kỳ (DS-13: bộ đếm và mốc đến hạn), theo
// lịch thì hạn kế tiếp; chưa có số thì chỉ ghi chu kỳ
export function describePlanProgress(
  plan: Pick<MaintenancePlan, 'basis' | 'interval' | 'next_due_at'>,
  usage: { used: number } | null,
): string {
  if (plan.basis === 'RUN_HOURS' && usage) {
    return t('Đã chạy {used}/{interval} giờ', { used: formatDecimal(usage.used, 1), interval: formatDecimal(plan.interval) })
  }
  if (plan.basis === 'SWITCHES' && usage) {
    return t('Đã đóng cắt {used}/{interval} lần', { used: formatDecimal(usage.used), interval: formatDecimal(plan.interval) })
  }
  if (plan.basis === 'CALENDAR' && plan.next_due_at) {
    return t('Hạn kế tiếp {date}', { date: formatMaintenanceDate(plan.next_due_at) })
  }
  return t('Chu kỳ {interval}', { interval: formatMaintenanceInterval(plan.basis, plan.interval) })
}
