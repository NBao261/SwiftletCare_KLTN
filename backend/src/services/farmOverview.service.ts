import { Types } from 'mongoose'
import { Alert } from '@/models/alert.model'
import { CameraNode, IN_SERVICE, SensorNode } from '@/models/device.model'
import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { House, IHouse, Zone } from '@/models/houseZone.model'
import { WorkOrder } from '@/models/workOrder.model'
import { houseDailyCounts, vnDate } from '@/services/birdCount.service'
import { assertFarmAccess } from '@/utils/farmAccess.util'
import type { CurrentUser, HealthStatus, HouseStage } from '@/types'

/**
 * Report 3 §4.5 — "tỷ lệ chim về gần nhất" tìm trong chừng này ngày: không gom toàn bộ lịch sử số đếm của mọi nhà mỗi
 * lần mở trang; nhà không có ngày nào có tỷ lệ trong khoảng này hiện `null`.
 */
export const LATEST_RETURN_RATE_DAYS = 30
/** Cảnh báo còn chờ xử lý: bác bỏ (`DISMISSED`) là báo động giả, không tính là đang mở */
const UNHANDLED_ALERT_STATUSES = ['ACTIVE', 'ACKNOWLEDGED']

export type FarmHouse = Pick<IHouse, '_id' | 'name' | 'stage'>

/** Số cảnh báo đang mở theo nhà: cảnh báo của nhà (camera đếm chim) và của các zone trong nhà */
export async function openAlertCounts(farmId: unknown, houses: FarmHouse[]): Promise<Map<string, number>> {
  const houseIds = houses.map(h => h._id)
  const zones = await Zone.find({ house_id: { $in: houseIds } }).select('house_id').lean()
  const houseOfZone = new Map(zones.map(z => [String(z._id), String(z.house_id)]))
  const alerts = await Alert.find({
    farm_id: farmId, status: { $in: UNHANDLED_ALERT_STATUSES },
    $or: [{ house_id: { $in: houseIds } }, { zone_id: { $in: zones.map(z => z._id) } }],
  }).select('house_id zone_id').lean()
  const counts = new Map<string, number>()
  for (const a of alerts) {
    const houseId = a.house_id ? String(a.house_id) : houseOfZone.get(String(a.zone_id))
    if (houseId) counts.set(houseId, (counts.get(houseId) ?? 0) + 1)
  }
  return counts
}

/**
 * SYSTEM-FR-004 — nhà có thiết bị và mọi thiết bị (controller của các zone, camera của nhà) đều là thiết bị giả lập
 * thì hiện là nhà giả lập; nhà trộn thiết bị thật và giả lập thì không.
 */
async function simulatedHouses(houses: FarmHouse[]): Promise<Set<string>> {
  const houseIds = houses.map(h => h._id)
  const zones = await Zone.find({ house_id: { $in: houseIds } }).select('house_id').lean()
  const houseOfZone = new Map(zones.map(z => [String(z._id), String(z.house_id)]))
  const [nodes, cameras] = await Promise.all([
    SensorNode.find({ ...IN_SERVICE, zone_id: { $in: zones.map(z => z._id) } }).select('zone_id simulated').lean(),
    CameraNode.find({ ...IN_SERVICE, house_id: { $in: houseIds } }).select('house_id simulated').lean(),
  ])
  const flags = new Map<string, boolean[]>()
  const add = (houseId: string | undefined, simulated: boolean) => {
    if (houseId) flags.set(houseId, [...(flags.get(houseId) ?? []), simulated])
  }
  for (const n of nodes) add(houseOfZone.get(String(n.zone_id)), !!n.simulated)
  for (const c of cameras) add(String(c.house_id), !!c.simulated)
  return new Set([...flags].filter(([, list]) => list.length > 0 && list.every(Boolean)).map(([id]) => id))
}

export interface HouseOverview {
  house_id: string
  name: string
  stage: HouseStage
  /** Trạng thái hôm nay (giờ VN); null khi chưa có — xem `status_reason` */
  status: HealthStatus | null
  /** NOT_COMPUTED: chưa đánh giá hôm nay; INSUFFICIENT_DATA: đã đánh giá nhưng không đủ dữ liệu */
  status_reason: 'NOT_COMPUTED' | 'INSUFFICIENT_DATA' | null
  open_alerts: number
  open_work_orders: number
  latest_return_rate: { date: string; value: number } | null
  simulated: boolean
}

/**
 * ANALYTICS-FR-015 — tổng quan trại: mỗi nhà với giai đoạn, trạng thái hôm nay, cảnh báo và Work Order đang mở, tỷ lệ
 * chim về gần nhất. Farm Owner và Domain Expert (đọc) theo Report 3 §2.4; Farm Technician và Administrator không.
 */
export async function getFarmOverview(user: CurrentUser, farmId: string): Promise<{ farm_id: string; date: string; houses: HouseOverview[] }> {
  const farm = await assertFarmAccess(farmId, user)
  const today = vnDate(new Date())
  // Sắp theo tên tiếng Việt như bảng so sánh (thứ tự nhị phân của MongoDB đặt chữ có dấu sau 'z')
  const houses = (await House.find({ farm_id: farm._id }).select('name stage').lean<FarmHouse[]>())
    .sort((a, b) => a.name.localeCompare(b.name, 'vi') || String(a._id).localeCompare(String(b._id)))
  const recentFrom = vnDate(new Date(Date.now() - LATEST_RETURN_RATE_DAYS * 86_400_000))
  const houseIds = houses.map(h => h._id)

  const [days, alerts, workOrders, simulated, counts] = await Promise.all([
    HouseHealthDay.find({ house_id: { $in: houseIds }, date: today }).select('house_id current_status').lean(),
    openAlertCounts(farm._id, houses),
    WorkOrder.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { house_id: { $in: houseIds }, is_open: true } },
      { $group: { _id: '$house_id', n: { $sum: 1 } } },
    ]),
    simulatedHouses(houses),
    // Một nguồn cho số đếm của nhà (birdCount.service#houseDailyCounts), không tự gộp bird_count_records ở đây
    Promise.all(houses.map(h => houseDailyCounts(String(h._id), { from: recentFrom, to: today }))),
  ])
  const statusOf = new Map(days.map(d => [String(d.house_id), d.current_status]))
  const workOrdersOf = new Map(workOrders.map(w => [String(w._id), w.n]))

  return {
    farm_id: String(farm._id),
    date: today,
    houses: houses.map((h, i) => {
      const id = String(h._id)
      const status = statusOf.get(id) ?? null
      const latest = [...counts[i]].reverse().find(d => d.return_rate !== null)
      return {
        house_id: id,
        name: h.name,
        stage: h.stage,
        status: status === 'INSUFFICIENT_DATA' ? null : status,
        status_reason: status === null ? 'NOT_COMPUTED' : status === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT_DATA' : null,
        open_alerts: alerts.get(id) ?? 0,
        open_work_orders: workOrdersOf.get(id) ?? 0,
        latest_return_rate: latest ? { date: latest.date, value: latest.return_rate as number } : null,
        simulated: simulated.has(id),
      }
    }),
  }
}
