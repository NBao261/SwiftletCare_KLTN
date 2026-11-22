import { Alert } from '@/models/alert.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { WorkOrder, type SiteCause } from '@/models/workOrder.model'
import { ESCALATION_MIN, ESCALATION_MS } from '@/services/alertRouting.service'
import { BadRequestError, NotFoundError } from '@/utils/appError.util'
import { assertFarmAccess } from '@/utils/farmAccess.util'
import { onTimeMaintenanceRate } from '@/services/maintenance.service'
import type { CurrentUser } from '@/types'

/** Của Work Order nếu có, không thì của lần xác nhận */
interface Sample { tta?: number; ttr?: number; cause?: SiteCause }

const round1 = (ms: number) => Math.round(ms / 6_000) / 10
const mean = (values: number[]) => (values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null)

/** Mỗi cảnh báo một lần */
export function siteCauseCounts(samples: Sample[]): Partial<Record<SiteCause, number>> {
  const counts: Partial<Record<SiteCause, number>> = {}
  for (const { cause } of samples) if (cause) counts[cause] = (counts[cause] ?? 0) + 1
  return counts
}

export function opsRow(samples: Sample[]) {
  const tta = samples.flatMap(s => (s.tta === undefined ? [] : [s.tta]))
  const ttr = samples.flatMap(s => (s.ttr === undefined ? [] : [s.ttr]))
  return {
    alerts: samples.length,
    mtta_min: mean(tta),
    mttr_min: mean(ttr),
    acknowledged_within_target_pct: tta.length ? Math.round((100 * tta.filter(t => t <= ESCALATION_MS).length) / tta.length) : null,
  }
}

/** DISMISSED không tính. Số báo cáo nội bộ, không phải cam kết */
export async function getOpsMetrics(
  user: CurrentUser, query: { farmId: string; houseId?: string; from: Date; to: Date },
) {
  if (query.from >= query.to) throw BadRequestError('`from` phải trước `to`')
  const farm = await assertFarmAccess(query.farmId, user)
  const houses = await House.find({ farm_id: farm._id, ...(query.houseId && { _id: query.houseId }) }).select('name').lean()
  if (query.houseId && houses.length === 0) throw NotFoundError('Không tìm thấy nhà trong farm này')

  const { all, byHouse, byTechnician } = await collectAlertSamples(farm._id, houses.map(h => h._id), query.from, query.to)
  const technicians = await User.find({ _id: { $in: [...byTechnician.keys()] } }).select('full_name').lean()
  return {
    from: query.from,
    to: query.to,
    target_ack_min: ESCALATION_MIN,
    overall: opsRow(all),
    by_house: houses.map(h => ({ house_id: String(h._id), name: h.name, ...opsRow(byHouse.get(String(h._id)) ?? []) })),
    by_technician: technicians.map(t => ({ technician_id: String(t._id), full_name: t.full_name, ...opsRow(byTechnician.get(String(t._id)) ?? []) })),
    on_time_maintenance_rate: await onTimeMaintenanceRate(houses.map(h => h._id), query.from, query.to),
  }
}

/** Báo động giả không tính */
export async function collectAlertSamples(farmId: unknown, houseIds: unknown[], from: Date, to: Date) {
  const zones = await Zone.find({ house_id: { $in: houseIds } }).select('house_id').lean()
  const houseOfZone = new Map(zones.map(z => [String(z._id), String(z.house_id)]))

  const alerts = await Alert.find({
    farm_id: farmId,
    status: { $ne: 'DISMISSED' },
    // Bị bác bỏ rồi tự đóng vẫn là báo động giả
    'expert_verdict.result': { $ne: 'REJECTED' },
    created_at: { $gte: from, $lt: to },
    $or: [{ house_id: { $in: houseIds } }, { zone_id: { $in: zones.map(z => z._id) } }],
  }).select('house_id zone_id created_at acknowledged_at resolved_at routing site_cause.cause').lean()

  const workOrders = await WorkOrder.find({ alert_id: { $in: alerts.map(a => a._id) } }).select('alert_id status closed_at cause').lean()
  const closedAt = new Map(workOrders.filter(w => w.status === 'CLOSED').map(w => [String(w.alert_id), w.closed_at]))
  const workOrderCause = new Map(workOrders.filter(w => w.cause).map(w => [String(w.alert_id), w.cause]))

  const byHouse = new Map<string, Sample[]>()
  const byTechnician = new Map<string, Sample[]>()
  const all: Sample[] = []
  for (const a of alerts) {
    const end = closedAt.get(String(a._id)) ?? a.resolved_at
    const sample: Sample = {
      ...(a.acknowledged_at && { tta: a.acknowledged_at.getTime() - a.created_at.getTime() }),
      ...(end && { ttr: end.getTime() - a.created_at.getTime() }),
    }
    const cause = workOrderCause.get(String(a._id)) ?? a.site_cause?.cause
    if (cause) sample.cause = cause
    all.push(sample)
    const houseId = a.house_id ? String(a.house_id) : houseOfZone.get(String(a.zone_id))
    if (houseId) byHouse.set(houseId, [...(byHouse.get(houseId) ?? []), sample])
    const technicianId = a.routing?.technician_id ? String(a.routing.technician_id) : undefined
    if (technicianId) byTechnician.set(technicianId, [...(byTechnician.get(technicianId) ?? []), sample])
  }
  return { all, byHouse, byTechnician }
}
