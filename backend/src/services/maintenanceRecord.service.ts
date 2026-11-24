import { SensorNode } from '@/models/device.model'
import { MaintenancePlan, type MaintenanceEquipment } from '@/models/maintenancePlan.model'
import { WorkOrder, type IWorkOrder } from '@/models/workOrder.model'

export const LOAD_OF_EQUIPMENT: Partial<Record<MaintenanceEquipment, 'misting' | 'ventilation'>> = {
  PUMP: 'misting',
  FAN: 'ventilation',
}

const DAY_MS = 86_400_000

// Tách khỏi maintenance.service để workOrder.service gọi được mà không import vòng
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
