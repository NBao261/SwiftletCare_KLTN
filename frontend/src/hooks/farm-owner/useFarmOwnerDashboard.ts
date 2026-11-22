import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { telemetryApi } from '@/apis/farm-owner/telemetry.api'
import { deviceApi } from '@/apis/shared/devices.api'
import { useAllZones, type AllZone } from '@/hooks/shared/useFarms'
import { useSensorNodes } from '@/hooks/shared/useDevices'
import { useLiveZoneTelemetry, type LiveZone } from '@/hooks/farm-owner/useLiveZoneTelemetry'
import { useSocketConnected } from '@/hooks/common/useSocketConnected'
import type { House, TelemetryRecord } from '@/types'
import {
  averageReadings,
  latestTimestamp,
  summarizeNodes,
  withLiveRelays,
  averageControlOutput,
  isFaultDeviceStatus,
  zoneHasIssue,
} from '@/components/features/farm-owner/dashboard/dashboardMetrics'

// Mất socket thì hỏi lại số đo, relay mỗi 15 giây (FE_Design 5.5)
const FALLBACK_POLL_MS = 15_000

// Số đo của 1 Zone: lấy bản mới hơn giữa gói socket và bản REST (mất socket thì bản REST hỏi lại định kỳ mới là bản mới)
function pickReadings(now: LiveZone | undefined, record: TelemetryRecord | undefined) {
  const useLive = now?.timestamp !== undefined && (!record?.timestamp || now.timestamp >= record.timestamp)
  if (!useLive) {
    return { temperature: record?.temperature, humidity: record?.humidity, light_lux: record?.light_lux, nh3_ppm: record?.nh3_ppm, co2_ppm: record?.co2_ppm, sound_db: record?.sound_db }
  }
  return {
    temperature: now?.temperature ?? record?.temperature,
    humidity: now?.humidity ?? record?.humidity,
    light_lux: now?.light ?? record?.light_lux,
    nh3_ppm: now?.nh3 ?? record?.nh3_ppm,
    co2_ppm: now?.co2 ?? record?.co2_ppm,
    sound_db: now?.sound ?? record?.sound_db,
  }
}

// Mọi camera tài khoản xem được (chung cache ['camera-nodes'] với trang Thiết bị, Trang trại)
export function useCameraNodes() {
  return useQuery({
    queryKey: ['camera-nodes'],
    queryFn: () => deviceApi.listCameraNodes().then(response => response.data.data),
  })
}

// Các Zone trong phạm vi đang chọn: cả farm hoặc 1 nhà yến
export function useScopeZones(farmId: string, houseId: string) {
  const { data: allZones, isLoading, isError } = useAllZones()
  const zones = useMemo(
    () => (allZones ?? []).filter(zone => zone.farmId === farmId && (!houseId || zone.house_id === houseId)),
    [allZones, farmId, houseId],
  )
  return { zones, isLoading, isError }
}

// Số đo, relay và đồng bộ của các Zone đang chọn
export function useZonesEnvironment(zones: AllZone[]) {
  const zoneIds = useMemo(() => zones.map(zone => zone._id), [zones])
  const live = useLiveZoneTelemetry(zoneIds)
  const isLive = useSocketConnected()
  const pollInterval = isLive ? false : FALLBACK_POLL_MS
  const { data: allSensors } = useSensorNodes(undefined, { refetchInterval: pollInterval })
  const sensors = useMemo(() => {
    const zoneIdSet = new Set(zoneIds)
    return (allSensors ?? []).filter(sensor => zoneIdSet.has(sensor.zone_id))
  }, [allSensors, zoneIds])

  const onlineZoneIds = useMemo(
    () => new Set(sensors.filter(sensor => sensor.status === 'ONLINE').map(sensor => sensor.zone_id)),
    [sensors],
  )
  const isActive = onlineZoneIds.size > 0

  const { isLoading: isLoadingLatest, latest } = useQueries({
    queries: zoneIds.map(zoneId => ({
      queryKey: ['telemetry', 'latest', zoneId],
      queryFn: () => telemetryApi.getLatest(zoneId).then(response => response.data.data),
      retry: false,
      refetchInterval: pollInterval,
    })),
    combine: results => ({
      isLoading: results.some(result => result.isLoading),
      // Zone chưa có số đo → backend trả null
      latest: results.map((r, index) => ({ zoneId: zoneIds[index], record: r.data ?? undefined })),
    }),
  })

  const readings = useMemo(
    () => averageReadings(latest
      .filter(({ zoneId }) => !isActive || onlineZoneIds.has(zoneId))
      .map(({ zoneId, record }) => pickReadings(live.get(zoneId), record))),
    [latest, live, isActive, onlineZoneIds],
  )

  const lastSyncedAt = useMemo(
    () => latestTimestamp(latest.flatMap(({ zoneId, record }) => [live.get(zoneId)?.timestamp, record?.timestamp])),
    [latest, live],
  )
  const control = useMemo(() => summarizeNodes(withLiveRelays(sensors, live)), [sensors, live])

  // Zone cần chú ý (thiết bị hư hoặc vượt ngưỡng của chính Zone): chấm cảnh báo ở ô chọn Zone
  const issueZoneIds = useMemo(() => {
    const faultZoneIds = new Set(sensors.filter(sensor => isFaultDeviceStatus(sensor.status)).map(sensor => sensor.zone_id))
    const thresholdsByZone = new Map(zones.map(zone => [zone._id, zone.thresholds]))
    const result = new Set<string>()
    for (const { zoneId, record } of latest) {
      const readings = pickReadings(live.get(zoneId), record)
      const hasIssue = zoneHasIssue({
        readings,
        thresholds: thresholdsByZone.get(zoneId),
        isOnline: onlineZoneIds.has(zoneId),
        hasFaultDevice: faultZoneIds.has(zoneId),
      })
      if (hasIssue) result.add(zoneId)
    }
    return result
  }, [sensors, zones, latest, live, onlineZoneIds])

  return {
    zones,
    readings,
    thresholds: zones[0]?.thresholds,
    isActive,
    lastSyncedAt,
    controlMode: control.controlMode,
    overrideExpiry: control.overrideExpiry,
    relayStates: control.relayStates,
    controlOutput: useMemo(() => averageControlOutput(zoneIds, live), [zoneIds, live]),
    deviceNames: useMemo(() => new Map(sensors.map(sensor => [sensor._id, sensor.device_id])), [sensors]),
    issueZoneIds,
    isLoading: isLoadingLatest,
  }
}

// Chấm cảnh báo ở khung lọc: Zone vượt ngưỡng hoặc có thiết bị hư; nhà có Zone như vậy hoặc camera hư; farm chứa nhà như vậy
export function useScopeIssues(zones: AllZone[], houses: House[]) {
  const { issueZoneIds } = useZonesEnvironment(zones)
  const { data: cameras } = useCameraNodes()
  return useMemo(() => {
    const farmByHouse = new Map(houses.map(house => [house._id, house.farm_id]))
    const issueHouseIds = new Set<string>()
    for (const zone of zones) {
      if (issueZoneIds.has(zone._id)) issueHouseIds.add(zone.house_id)
    }
    for (const camera of cameras ?? []) {
      if (camera.house_id && !camera.decommissioned_at && isFaultDeviceStatus(camera.status)) issueHouseIds.add(camera.house_id)
    }
    const issueFarmIds = new Set<string>()
    for (const houseId of issueHouseIds) {
      const farmId = farmByHouse.get(houseId)
      if (farmId) issueFarmIds.add(farmId)
    }
    return { issueFarmIds, issueHouseIds, issueZoneIds }
  }, [zones, houses, cameras, issueZoneIds])
}

