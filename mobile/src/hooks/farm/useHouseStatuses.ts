import { useAllActiveAlerts } from '@/hooks/alert/useAllActiveAlerts'
import { useActiveRelayOverrides } from '@/hooks/device/useActiveRelayOverrides'
import { useCameraNodes } from '@/hooks/device/useCameraNodes'
import { useSensorNodes } from '@/hooks/device/useSensorNodes'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useFarms } from '@/hooks/farm/useFarms'
import { useZonesOfHouses } from '@/hooks/farm/useZonesOfHouses'
import type { House } from '@/types'
import { getHouseStatus, getHouseStatusRank, type HouseStatus, type HouseStatusInput } from '@/utils/houseStatus.utils'

export interface HouseCardData {
  house: House
  farmName: string
  status: HouseStatus
  // Số cảnh báo chờ xác nhận của nhà, kể cả cảnh báo thiết bị mất kết nối
  activeAlertCount: number
}

// Trạng thái từng nhà của mọi Farm, nhà có vấn đề nặng hơn xếp trước
export function useHouseStatuses(now: number) {
  const farmsQuery = useFarms()
  const housesQuery = useAllHouses()
  const zonesQuery = useZonesOfHouses(housesQuery.houses.map(house => house._id))
  const sensorNodesQuery = useSensorNodes()
  const cameraNodesQuery = useCameraNodes()
  const alertsQuery = useAllActiveAlerts()
  const { overrides } = useActiveRelayOverrides()

  const isLoading = [farmsQuery, housesQuery, zonesQuery, sensorNodesQuery, cameraNodesQuery, alertsQuery].some(
    query => query.isLoading,
  )
  const isError = [farmsQuery, housesQuery, zonesQuery, sensorNodesQuery, cameraNodesQuery, alertsQuery].some(
    query => query.isError,
  )

  // Gom dữ liệu theo nhà trong một lượt mỗi danh sách
  const farmNameById = new Map((farmsQuery.data?.data ?? []).map(farm => [farm._id, farm.name]))
  const houseIdByZoneId = new Map(zonesQuery.zones.map(zone => [zone._id, zone.house_id]))
  const inputs = new Map<string, HouseStatusInput>(
    housesQuery.houses.map(house => [
      house._id,
      { zones: [], sensorNodes: [], cameraNodes: [], activeAlerts: [], manualOverrides: [] },
    ]),
  )
  const groupOf = (houseId: string | undefined) => (houseId ? inputs.get(houseId) : undefined)

  zonesQuery.zones.forEach(zone => groupOf(zone.house_id)?.zones.push(zone))
  ;(sensorNodesQuery.data?.data ?? []).forEach(node => groupOf(houseIdByZoneId.get(node.zone_id))?.sensorNodes.push(node))
  ;(cameraNodesQuery.data?.data ?? []).forEach(camera => groupOf(camera.house_id)?.cameraNodes.push(camera))
  ;(alertsQuery.data ?? []).forEach(alert =>
    groupOf(alert.house_id ?? (alert.zone_id ? houseIdByZoneId.get(alert.zone_id) : undefined))?.activeAlerts.push(alert),
  )
  overrides.forEach(({ log }) => groupOf(houseIdByZoneId.get(log.zone_id))?.manualOverrides.push(log))

  const items: HouseCardData[] = housesQuery.houses
    .map(house => {
      const input = inputs.get(house._id) as HouseStatusInput
      return {
        house,
        farmName: farmNameById.get(house.farm_id) ?? '_',
        status: getHouseStatus(input, now),
        activeAlertCount: input.activeAlerts.length,
      }
    })
    .sort(
      (first, second) =>
        getHouseStatusRank(first.status.kind) - getHouseStatusRank(second.status.kind) ||
        first.house.name.localeCompare(second.house.name),
    )

  return { items, isLoading, isError }
}
