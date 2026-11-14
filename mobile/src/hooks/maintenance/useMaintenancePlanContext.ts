import { useSensorNodes } from '@/hooks/device/useSensorNodes'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import type { MaintenancePlan } from '@/types'
import { getPlanUsage } from '@/utils/maintenance.utils'

// Thông tin đi kèm một kế hoạch bảo trì trên màn: tên nhà (từ danh sách nhà đã tải) và mức đã dùng từ bộ đếm giờ chạy / số lần đóng
// cắt của các controller trong nhà (BR-45) — dùng chung cache nhà, tầng, controller
export function useMaintenancePlanContext() {
  const { houseById, zoneById } = useZoneDirectory()
  const sensorNodesQuery = useSensorNodes()
  const sensorNodes = sensorNodesQuery.data?.data ?? []

  return {
    getHouseName: (plan: MaintenancePlan) => houseById.get(plan.house_id)?.name ?? '_',
    getUsage: (plan: MaintenancePlan) => getPlanUsage(plan, sensorNodes, zoneById),
  }
}
