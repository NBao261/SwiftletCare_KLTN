import { useEffect } from 'react'
import { getScopeKey, useActiveAlertsOfScopes } from '@/hooks/alert/useActiveAlertsOfScopes'
import { useRefreshAlertsOnNew } from '@/hooks/alert/useRefreshAlertsOnNew'
import { useLiveHouseBirdCount } from '@/hooks/bird-count/useLiveHouseBirdCount'
import { useCameraNodes } from '@/hooks/device/useCameraNodes'
import { useDeviceStream } from '@/hooks/device/useDeviceStream'
import { useSensorNodes } from '@/hooks/device/useSensorNodes'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useFarmPrefs } from '@/hooks/farm/useFarmPrefs'
import { useHouseZones } from '@/hooks/farm/useHouseZones'
import { useLatestTelemetryOfZones } from '@/hooks/telemetry/useLatestTelemetryOfZones'
import { useSocketConnection } from '@/hooks/telemetry/useSocketConnection'
import { useZoneTelemetryStream } from '@/hooks/telemetry/useZoneTelemetryStream'
import { useFarmPrefsStore } from '@/stores/farmPrefsStore'
import type { Alert } from '@/types'
import { getHighestSeverity } from '@/utils/alert.utils'

// Dữ liệu Màn B của một nhà: zone, camera, controller của zone đang chọn, số đo realtime, số chim, cảnh báo.
// Zone đang chọn: zone truyền vào (link từ Trang chủ), rồi zone xem lần trước của nhà, rồi tầng thấp nhất
export function useHouseDetail(houseId: string, selectedZoneId: string | undefined) {
  const { userId, prefs } = useFarmPrefs()
  const setLastHouse = useFarmPrefsStore(state => state.setLastHouse)
  const setCurrentFarm = useFarmPrefsStore(state => state.setCurrentFarm)
  const markAutoOpened = useFarmPrefsStore(state => state.markAutoOpened)
  const housesQuery = useAllHouses()
  const house = housesQuery.houses.find(item => item._id === houseId) ?? null
  const zonesQuery = useHouseZones(houseId)
  const zones = zonesQuery.data ?? []
  const zone =
    zones.find(item => item._id === selectedZoneId) ??
    zones.find(item => item._id === prefs.lastZoneIdByHouse[houseId]) ??
    zones[0] ??
    null
  const zoneId = zone?._id ?? ''

  const cameraNodesQuery = useCameraNodes()
  const sensorNodesQuery = useSensorNodes()
  const cameras = (cameraNodesQuery.data?.data ?? []).filter(camera => camera.house_id === houseId)
  const controllers = (sensorNodesQuery.data?.data ?? []).filter(node => node.zone_id === zoneId)
  const telemetryQuery = useLatestTelemetryOfZones(zoneId ? [zoneId] : [])
  const today = useLiveHouseBirdCount(houseId)
  const alertsQuery = useActiveAlertsOfScopes([{ houseId }, ...zones.map(item => ({ zoneId: item._id }))])
  const isSocketConnected = useSocketConnection()

  // Realtime: số đo của zone đang chọn, relay và trạng thái thiết bị, cảnh báo mới
  useZoneTelemetryStream(zoneId ? [zoneId] : [])
  useDeviceStream()
  useRefreshAlertsOnNew()

  // Mở nhà nào thì nhà đó là nhà xem gần nhất của farm; lần sau vào tab Farm thì mở thẳng nhà này
  const farmId = house?.farm_id
  useEffect(() => {
    if (!userId || !farmId) return
    setLastHouse(userId, farmId, houseId)
    setCurrentFarm(userId, farmId)
    // Đã ở trong nhà rồi thì quay lại danh sách không bị tự mở lần nữa
    markAutoOpened(farmId)
  }, [userId, farmId, houseId, setLastHouse, setCurrentFarm, markAutoOpened])

  const houseScope = alertsQuery.byScopeKey.get(getScopeKey({ houseId }))
  const zoneAlerts: Alert[] = zoneId ? (alertsQuery.byScopeKey.get(getScopeKey({ zoneId }))?.alerts ?? []) : []
  const zoneAlertCount = zoneId ? (alertsQuery.byScopeKey.get(getScopeKey({ zoneId }))?.total ?? 0) : 0
  const houseAlertCount =
    (houseScope?.total ?? 0) +
    zones.reduce((total, item) => total + (alertsQuery.byScopeKey.get(getScopeKey({ zoneId: item._id }))?.total ?? 0), 0)
  const alertZoneIds = new Set(
    zones.filter(item => (alertsQuery.byScopeKey.get(getScopeKey({ zoneId: item._id }))?.total ?? 0) > 0).map(item => item._id),
  )

  return {
    house,
    zones,
    zone,
    cameras,
    controllers,
    telemetry: zoneId ? (telemetryQuery.latestByZoneId.get(zoneId) ?? null) : null,
    today,
    zoneAlerts,
    zoneAlertCount,
    zoneHighestSeverity: getHighestSeverity(zoneAlerts),
    houseAlertCount,
    alertZoneIds,
    isSocketConnected,
    isHouseLoading: housesQuery.isLoading,
    isHouseError: housesQuery.isError,
    isZonesLoading: zonesQuery.isLoading,
    isZonesError: zonesQuery.isError,
    isCamerasLoading: cameraNodesQuery.isLoading,
    isCamerasError: cameraNodesQuery.isError,
    isSensorsLoading: sensorNodesQuery.isLoading || telemetryQuery.isLoading,
    isSensorsError: sensorNodesQuery.isError || telemetryQuery.isError,
  }
}
