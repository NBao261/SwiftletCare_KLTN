import { SensorNode } from '@/models/device.model'
import { MaintenancePlan, type MaintenanceEquipment } from '@/models/maintenancePlan.model'
import { WorkOrder, type IWorkOrder } from '@/models/workOrder.model'

/** Bơm và quạt có bộ đếm theo relay (BR-45); thiết bị khác bảo trì theo lịch */
export const LOAD_OF_EQUIPMENT: Partial<Record<MaintenanceEquipment, 'misting' | 'ventilation'>> = {
  PUMP: 'misting',
  FAN: 'ventilation',
}

const DAY_MS = 86_400_000

/**
 * OPS-FR-008 — Farm Owner duyệt một Work Order phòng ngừa là một lần ghi bảo trì: đặt bộ đếm của tải về 0 (kế hoạch
 * theo giờ chạy hoặc số lần đóng cắt), tính điểm đến hạn kế tiếp (kế hoạch theo lịch; hiệu chuẩn thì là ngày hiệu
 * chuẩn kế tiếp), ghi vào lịch sử, và đưa kế hoạch về SCHEDULED khi không còn Work Order phòng ngừa nào đang mở
 * (SM-20). Gọi sau khi Work Order đã CLOSED; tách khỏi maintenance.service để workOrder.service gọi được mà không
 * import vòng.
 */
export async function recordMaintenance(wo: IWorkOrder, userId: string, now = new Date()): Promise<void> {
  if (!wo.plan_id) return
  const plan = await MaintenancePlan.findById(wo.plan_id)
  if (!plan) return

  const load = LOAD_OF_EQUIPMENT[plan.equipment]
  if (load && wo.node_id) {
    await SensorNode.updateOne({ _id: wo.node_id }, {
      $set: { [`relay_usage.${load}.since_service_hours`]: 0, [`relay_usage.${load}.since_service_switches`]: 0 },
    })
  }
  const nextDue = plan.basis === 'CALENDAR' ? new Date(now.getTime() + plan.interval * DAY_MS) : undefined
  const stillOpen = await WorkOrder.exists({ plan_id: plan._id, is_open: true, _id: { $ne: wo._id } })

  plan.records.push({
    work_order_id: wo._id, node_id: wo.node_id, kind: plan.equipment === 'CALIBRATION' ? 'CALIBRATION' : 'MAINTENANCE',
    by: userId as never, at: now, next_due_at: nextDue,
  })
  plan.last_done_at = now
  if (nextDue) plan.next_due_at = nextDue
  if (!stillOpen && plan.state !== 'RETIRED') {
    plan.state = 'SCHEDULED'
    plan.due_since = undefined
    plan.overdue_notified_at = undefined
  }
  await plan.save()
}
