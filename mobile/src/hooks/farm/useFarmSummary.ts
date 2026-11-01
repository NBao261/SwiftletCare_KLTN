import { useCameraNodes } from '@/hooks/device/useCameraNodes'
import { useSensorNodes } from '@/hooks/device/useSensorNodes'
import { useZonesOfHouses } from '@/hooks/farm/useZonesOfHouses'

export interface FarmSummary {
  houseCount: number
  zoneCount: number
  deviceOnlineCount: number
  deviceCount: number
}

// Dải tóm tắt farm ở Màn A: số nhà, số tầng, thiết bị (controller + camera) online / tổng — dùng chung cache với Trang chủ
export function useFarmSummary(houseIds: string[]) {
  const zonesQuery = useZonesOfHouses(houseIds)
  const sensorNodesQuery = useSensorNodes()
  const cameraNodesQuery = useCameraNodes()
  const houseIdSet = new Set(houseIds)
  const zoneIdSet = new Set(zonesQuery.zones.map(zone => zone._id))
  const devices = [
    ...(sensorNodesQuery.data?.data ?? []).filter(node => zoneIdSet.has(node.zone_id)),
    ...(cameraNodesQuery.data?.data ?? []).filter(camera => houseIdSet.has(camera.house_id)),
  ]

  const summary: FarmSummary = {
    houseCount: houseIds.length,
    zoneCount: zonesQuery.zones.length,
    deviceOnlineCount: devices.filter(device => device.status === 'ONLINE').length,
    deviceCount: devices.length,
  }
  return {
    summary,
    isLoading: [zonesQuery, sensorNodesQuery, cameraNodesQuery].some(query => query.isLoading),
  }
}
