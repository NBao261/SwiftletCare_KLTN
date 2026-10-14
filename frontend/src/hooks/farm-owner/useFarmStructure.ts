import { useMemo } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/apis/shared/farms.api'
import { deviceApi } from '@/apis/shared/devices.api'
import { alertApi } from '@/apis/shared/alerts.api'
import { harvestApi } from '@/apis/farm-owner/harvests.api'
import { farmMockApi } from '@/apis/farm-owner/farmMock.api'
import { useFarms } from '@/hooks/shared/useFarms'
import { useSensorNodes } from '@/hooks/shared/useDevices'
import { useEnvCompareBatched } from '@/hooks/farm-owner/useAnalytics'
import { useLiveZoneTelemetry } from '@/hooks/farm-owner/useLiveZoneTelemetry'
import { usePermission } from '@/hooks/common/usePermission'
import { HARVEST_ROLES } from '@/constants/roles'
import { buildFarmStructure, mergeMetrics, type ZoneMetrics } from '@/components/features/farm-owner/farms/farmStructure'
import type { House, Zone } from '@/types'

/** Cấu trúc House/Zone hiếm khi đổi — cùng staleTime với useFarmZones/useAllZones để dùng chung cache */
const STRUCTURE_STALE_MS = 5 * 60 * 1000

/**
 * Cây Farm → House → Zone → Device cho màn "Cấu trúc Farm".
 *
 * Độ trễ: thiết bị / camera / cảnh báo / thu hoạch đều là 1 request gộp theo quyền truy
 * cập (không lọc zone) và chạy SONG SONG với chuỗi farms → houses → zones, thay vì gọi
 * lần lượt theo từng zone. Số đo môi trường lấy theo lô 6 zone/request (/analytics/env/
 * compare) thay vì 1 request/zone. `liveZoneIds` (nếu có) mới join room socket — màn tổng
 * quan không join hàng loạt zone, chỉ trang nhà/zone mới theo dõi realtime.
 */
export function useFarmStructure(options?: { liveZoneIds?: string[] }) {
  const queryClient = useQueryClient()
  // GET /harvests chỉ cho FARM_OWNER/ADMIN — Technician cũng mở được màn này nên không gọi, tránh 403 rồi hiện 0 kg sai
  const canViewHarvest = usePermission(...HARVEST_ROLES)
  const farmsQ = useFarms()
  const farms = farmsQ.data

  const housesQ = useQueries({
    queries: (farms ?? []).map(f => ({
      queryKey: ['houses', f._id],
      queryFn: () => farmApi.listHouses(f._id).then(r => r.data.data),
      staleTime: STRUCTURE_STALE_MS,
    })),
    combine: results => ({
      pending: results.some(r => r.isPending),
      error: results.some(r => r.isError),
      data: results.map(r => r.data),
    }),
  })

  const housesByFarm = useMemo(() => {
    const map = new Map<string, House[]>()
    farms?.forEach((f, i) => map.set(f._id, housesQ.data[i] ?? []))
    return map
  }, [farms, housesQ.data])

  const allHouses = useMemo(() => [...housesByFarm.values()].flat(), [housesByFarm])

  const zonesQ = useQueries({
    queries: allHouses.map(h => ({
      queryKey: ['zones', h._id],
      queryFn: () => farmApi.listZones(h._id).then(r => r.data.data),
      staleTime: STRUCTURE_STALE_MS,
    })),
    combine: results => ({
      pending: results.some(r => r.isPending),
      error: results.some(r => r.isError),
      data: results.map(r => r.data),
    }),
  })

  const zonesByHouse = useMemo(() => {
    const map = new Map<string, Zone[]>()
    allHouses.forEach((h, i) => map.set(h._id, zonesQ.data[i] ?? []))
    return map
  }, [allHouses, zonesQ.data])

  const sensorsQ = useSensorNodes()
  const camerasQ = useQuery({
    queryKey: ['camera-nodes'],
    queryFn: () => deviceApi.listCameraNodes().then(r => r.data.data),
  })
  const alertsQ = useQuery({
    queryKey: ['alerts', 'active-structure'],
    // 1 trang 100 cảnh báo mới nhất để gán theo zone; tổng thật lấy từ meta.total (có thể lớn hơn 100)
    queryFn: () => alertApi.list({ status: 'ACTIVE', limit: '100' }).then(r => ({ items: r.data.data, total: r.data.meta?.total ?? r.data.data.length })),
  })
  const harvestsQ = useQuery({
    queryKey: ['harvests', 'all'],
    queryFn: () => harvestApi.list().then(r => r.data.data),
    enabled: canViewHarvest,
  })

  const zoneIds = useMemo(() => [...zonesByHouse.values()].flat().map(z => z._id), [zonesByHouse])
  const envQ = useEnvCompareBatched(zoneIds, '1h')
  const live = useLiveZoneTelemetry(options?.liveZoneIds ?? [])

  const metricsByZone = useMemo(() => {
    const avg = new Map<string, ZoneMetrics>()
    for (const z of envQ.zones) {
      if (!z.metrics) continue
      avg.set(z.zoneId, {
        temperature: z.metrics.temperature, humidity: z.metrics.humidity,
        light: z.metrics.light_lux, nh3: z.metrics.nh3_ppm, co2: z.metrics.co2_ppm,
      })
    }
    const merged = new Map<string, ZoneMetrics>()
    for (const id of zoneIds) {
      const m = mergeMetrics(live.get(id), avg.get(id))
      if (m) merged.set(id, m)
    }
    return merged
  }, [envQ.zones, live, zoneIds])

  const built = useMemo(
    () => buildFarmStructure({
      farms: farms ?? [], housesByFarm, zonesByHouse,
      sensors: sensorsQ.data ?? [], cameras: camerasQ.data ?? [],
      alerts: alertsQ.data?.items ?? [], harvests: harvestsQ.data ?? [], metricsByZone,
    }),
    [farms, housesByFarm, zonesByHouse, sensorsQ.data, camerasQ.data, alertsQ.data, harvestsQ.data, metricsByZone],
  )
  const alertsTotal = alertsQ.data?.total ?? 0
  const structure = useMemo(
    () => (alertsTotal > built.totals.alerts.total
      ? { ...built, totals: { ...built.totals, alerts: { ...built.totals.alerts, total: alertsTotal } } }
      : built),
    [built, alertsTotal],
  )

  const isLoading = farmsQ.isLoading || housesQ.pending || zonesQ.pending
    || sensorsQ.isLoading || camerasQ.isLoading || alertsQ.isLoading || harvestsQ.isLoading
  // Cảnh báo/camera/thu hoạch lỗi mà vẫn dựng cây thì màn báo sai "0 cảnh báo, Bình thường" — coi là lỗi cả trang (FE_Design 13.5)
  const isError = farmsQ.isError || housesQ.error || zonesQ.error || sensorsQ.isError
    || camerasQ.isError || alertsQ.isError || (canViewHarvest && harvestsQ.isError)

  return {
    structure, isLoading, isError,
    /** Số đo trung bình đang tải — card hiện "--" thay vì chặn cả trang */
    metricsLoading: envQ.isLoading,
    /** Có quyền xem thu hoạch không — role không có quyền thì UI ẩn mọi khối sản lượng thay vì hiện 0 */
    canViewHarvest,
    /** Tải lại mọi nguồn của cây, kể cả houses/zones (useQueries không có refetch chung) */
    refetch: () => {
      for (const key of ['farms', 'houses', 'zones', 'sensor-nodes', 'camera-nodes', 'alerts']) void queryClient.refetchQueries({ queryKey: [key] })
      if (canViewHarvest) void harvestsQ.refetch()
    },
  }
}

/** Trường backend chưa có (người phụ trách, lịch thu dự kiến) — hiện rỗng, xem farmMock.api.ts. staleTime Infinity: chưa có nguồn thật để làm mới. */
export function useStructureExtras(houseIds: string[]) {
  const key = houseIds.join(',')
  return useQuery({
    queryKey: ['farm-mock', 'extras', key],
    queryFn: () => farmMockApi.getStructureExtras(houseIds).then(r => r.data.data),
    enabled: houseIds.length > 0,
    staleTime: Infinity,
  })
}

export function useHouseAdvice(houseId: string | undefined) {
  return useQuery({
    queryKey: ['farm-mock', 'advice', houseId],
    queryFn: () => farmMockApi.getHouseAdvice(houseId!).then(r => r.data.data),
    enabled: !!houseId,
    staleTime: Infinity,
  })
}

export function useDeviceProfile(deviceId: string | undefined) {
  return useQuery({
    queryKey: ['farm-mock', 'device-profile', deviceId],
    queryFn: () => farmMockApi.getDeviceProfile(deviceId!).then(r => r.data.data),
    enabled: !!deviceId,
    staleTime: Infinity,
  })
}

const NO_IDS: string[] = []

/** Id các zone của 1 nhà — dùng cache ['zones', houseId] của useFarmStructure (cùng staleTime) để trang nhà biết zone nào cần join socket */
export function useHouseZoneIds(houseId: string | undefined): string[] {
  const { data } = useQuery({
    queryKey: ['zones', houseId],
    queryFn: () => farmApi.listZones(houseId!).then(r => r.data.data),
    enabled: !!houseId,
    staleTime: STRUCTURE_STALE_MS,
  })
  return useMemo(() => data?.map(z => z._id) ?? NO_IDS, [data])
}
