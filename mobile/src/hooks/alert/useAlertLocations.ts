import { useCameraNodes } from '@/hooks/device/useCameraNodes'
import { useSensorNodes } from '@/hooks/device/useSensorNodes'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import type { Alert } from '@/types'

export interface AlertLocation {
  // Nhà của cảnh báo: cảnh báo mức nhà mang house_id, cảnh báo tầng tra qua tầng
  houseId: string | null
  houseName: string | null
  zoneName: string | null
  deviceName: string | null
  // "Nhà A › Tầng 2 · node_001"; thiếu phần nào thì bỏ phần đó, không có gì thì "_"
  text: string
}

// Tra tên nhà, tầng, thiết bị cho cảnh báo (ALERT-FR-008) từ danh sách nhà, tầng, thiết bị đã tải (dùng chung cache);
// node_id của cảnh báo là id bản ghi thiết bị nên đổi ra device_id để hiện
export function useAlertLocations() {
  const directory = useZoneDirectory()
  const sensorNodesQuery = useSensorNodes()
  const cameraNodesQuery = useCameraNodes()
  const deviceById = new Map<string, string>([
    ...(sensorNodesQuery.data?.data ?? []).map(node => [node._id, node.device_id] as const),
    ...(cameraNodesQuery.data?.data ?? []).map(camera => [camera._id, camera.device_id] as const),
  ])

  const locate = (alert: Alert): AlertLocation => {
    const zone = alert.zone_id ? directory.zoneById.get(alert.zone_id) : undefined
    const houseId = alert.house_id ?? zone?.house_id ?? null
    const houseName = houseId ? (directory.houseById.get(houseId)?.name ?? null) : null
    const zoneName = zone?.name ?? null
    const deviceName = alert.node_id ? (deviceById.get(alert.node_id) ?? null) : null
    const place = [houseName, zoneName].filter(Boolean).join(' › ')
    const text = [place, deviceName].filter(Boolean).join(' · ') || '_'
    return { houseId, houseName, zoneName, deviceName, text }
  }

  return { locate, zoneById: directory.zoneById }
}
