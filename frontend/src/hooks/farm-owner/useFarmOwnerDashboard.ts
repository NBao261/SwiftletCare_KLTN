import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/apis/farm-owner/analytics.api'
import { alertApi } from '@/apis/shared/alerts.api'
import { telemetryApi } from '@/apis/farm-owner/telemetry.api'
import { deviceApi } from '@/apis/shared/devices.api'
import { useAllZones, useHouses, type AllZone } from '@/hooks/shared/useFarms'
import { useSensorNodes } from '@/hooks/shared/useDevices'
import { useLiveZoneTelemetry } from '@/hooks/farm-owner/useLiveZoneTelemetry'
import {
  averageReadings,
  buildHouseStability,
  latestTimestamp,
  mergeBirdCountRecords,
  summarizeBirdCount,
  summarizeNodes,
  withLiveRelays,
  averageControlOutput,
} from '@/components/features/farm-owner/dashboard/dashboardMetrics'

const DAY_MS = 86_400_000
const ALERT_LOG_LIMIT = 50
const RETURN_RATE_DAYS = 30

// Trạng thái các nhà yến của farm
export function useHouseStability(farmId: string) {
  const { data: houses, isLoading: isLoadingHouses } = useHouses(farmId)
  const { data: zones, isLoading: isLoadingZones } = useAllZones()
  const { data: sensors, isLoading: isLoadingSensors } = useSensorNodes()
  const { data: cameras, isLoading: isLoadingCameras } = useQuery({
    queryKey: ['camera-nodes'],
    queryFn: () => deviceApi.listCameraNodes().then(r => r.data.data),
  })

  const items = useMemo(
    () => {
      const devices = [
        ...(sensors ?? []).map(device => ({ zone_id: device.zone_id, status: device.status, type: 'sensor' as const })),
        ...(cameras ?? []).map(device => ({ zone_id: device.zone_id, status: device.status, type: 'camera' as const })),
      ]
      return buildHouseStability(houses ?? [], zones ?? [], devices)
    },
    [houses, zones, sensors, cameras],
  )

  return { items, isLoading: isLoadingHouses || isLoadingZones || isLoadingSensors || isLoadingCameras }
}

// Các Zone trong phạm vi đang chọn: cả farm hoặc 1 nhà yến
export function useScopeZones(farmId: string, houseId: string) {
  const { data: allZones, isLoading } = useAllZones()
  const zones = useMemo(
    () => (allZones ?? []).filter(zone => zone.farmId === farmId && (!houseId || zone.house_id === houseId)),
    [allZones, farmId, houseId],
  )
  return { zones, isLoading }
}

// Số đo, relay và đồng bộ của các Zone đang chọn
export function useZonesEnvironment(zones: AllZone[]) {
  const zoneIds = useMemo(() => zones.map(zone => zone._id), [zones])
  const live = useLiveZoneTelemetry(zoneIds)
  const { data: allSensors } = useSensorNodes()
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
      queryFn: () => telemetryApi.getLatest(zoneId).then(r => r.data.data),
      retry: false,
    })),
    combine: results => ({
      isLoading: results.some(r => r.isLoading),
      latest: results.map((r, index) => ({ zoneId: zoneIds[index], record: r.data })),
    }),
  })

  const readings = useMemo(
    () => averageReadings(latest.filter(({ zoneId }) => !isActive || onlineZoneIds.has(zoneId)).map(({ zoneId, record }) => {
      const now = live.get(zoneId)
      return {
        temperature: now?.temperature ?? record?.temperature,
        humidity: now?.humidity ?? record?.humidity,
        light_lux: now?.light ?? record?.light_lux,
        nh3_ppm: now?.nh3 ?? record?.nh3_ppm,
        co2_ppm: now?.co2 ?? record?.co2_ppm,
        sound_db: now?.sound ?? record?.sound_db,
      }
    })),
    [latest, live, isActive, onlineZoneIds],
  )

  const lastSyncedAt = useMemo(
    () => latestTimestamp(latest.flatMap(({ zoneId, record }) => [live.get(zoneId)?.timestamp, record?.timestamp])),
    [latest, live],
  )
  const control = useMemo(() => summarizeNodes(withLiveRelays(sensors, live)), [sensors, live])

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
    isLoading: isLoadingLatest,
  }
}

// Chart thống kê chim
export function useBirdCount(zoneIds: string[], days: number) {
  const { records, isLoading, isError } = useQueries({
    queries: zoneIds.map(zoneId => ({
      queryKey: ['analytics', 'bird-count-daily', zoneId, days],
      queryFn: () => {
        const now = Date.now()
        const params = { from: new Date(now - 2 * days * DAY_MS).toISOString(), to: new Date(now).toISOString() }
        return analyticsApi.birdCountDaily(zoneId, params).then(r => r.data.data)
      },
    })),
    combine: results => ({
      isLoading: results.some(r => r.isLoading),
      isError: results.some(r => r.isError),
      records: mergeBirdCountRecords(results.map(r => r.data?.records ?? [])),
    }),
  })

  const summary = useMemo(() => summarizeBirdCount(records, days), [records, days])

  return { summary, isLoading, isError }
}

// Tỉ lệ chim về theo Zone
export function useZoneReturnRates(zoneIds: string[]) {
  return useQueries({
    queries: zoneIds.map(zoneId => ({
      queryKey: ['analytics', 'bird-count-trends', zoneId, RETURN_RATE_DAYS],
      queryFn: () => analyticsApi.birdCountTrends(zoneId, RETURN_RATE_DAYS).then(r => r.data.data),
    })),
    combine: results => ({
      isLoading: results.some(r => r.isLoading),
      rates: results.map((r, index) => ({ zoneId: zoneIds[index], rate: r.data?.latest_return_rate ?? undefined })),
    }),
  })
}

// Bảng nhật ký cảnh báo: cả farm gộp 1 request, 1 nhà yến thì lấy theo từng zone của nhà
export function useHouseAlerts(farmId: string, zoneIds: string[], wholeFarm: boolean) {
  let scopes = zoneIds.map(zoneId => ({ key: zoneId, filter: { zoneId } as Record<string, string> }))
  if (wholeFarm) scopes = farmId ? [{ key: farmId, filter: { farmId } }] : []
  return useQueries({
    queries: scopes.map(scope => ({
      queryKey: ['alerts', 'house-log', scope.key],
      queryFn: () => alertApi.list({ ...scope.filter, limit: String(ALERT_LOG_LIMIT) }).then(r => r.data.data),
    })),
    combine: results => ({
      isLoading: results.some(r => r.isLoading),
      isError: results.some(r => r.isError),
      records: results
        .flatMap(r => r.data ?? [])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, ALERT_LOG_LIMIT),
      refetch: () => results.forEach(r => void r.refetch()),
    }),
  })
}
