import { useMemo } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/apis/shared/farms.api'
import { deviceApi } from '@/apis/shared/devices.api'
import { alertApi } from '@/apis/shared/alerts.api'
import { harvestApi } from '@/apis/farm-owner/harvests.api'
import { useFarmDetails, useFarms } from '@/hooks/shared/useFarms'
import { useSensorNodes } from '@/hooks/shared/useDevices'
import { useEnvCompareBatched } from '@/hooks/farm-owner/useAnalytics'
import { useLiveZoneTelemetry } from '@/hooks/farm-owner/useLiveZoneTelemetry'
import { usePermission } from '@/hooks/common/usePermission'
import { HARVEST_ROLES } from '@/constants/roles'
import { buildFarmStructure, mergeMetrics, type ZoneMetrics } from '@/components/features/farm-owner/farms/farmStructure'
import type { House, Zone } from '@/types'

// Cấu trúc House/Zone hiếm khi đổi: cùng staleTime với useFarmZones/useAllZones để dùng chung cache
const STRUCTURE_STALE_MS = 5 * 60 * 1000

// Request gộp chạy song song với chuỗi farms → houses → zones; số đo lấy theo lô 6 zone; chỉ liveZoneIds mới join socket
export function useFarmStructure(options?: { liveZoneIds?: string[] }) {
  const queryClient = useQueryClient()
  // Technician cũng mở màn này nên không gọi /harvests, tránh 403 rồi hiện 0 kg sai
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

  // Chỉ hỏi số đo khi mọi nhà đã tải xong Zone: danh sách Zone lớn dần thì mỗi lần đổi là một lần gọi env/compare
  const zoneIds = useMemo(
    () => (housesQ.pending || zonesQ.pending ? [] : [...zonesByHouse.values()].flat().map(z => z._id)),
    [housesQ.pending, zonesQ.pending, zonesByHouse],
  )
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
      alerts: alertsQ.data?.items ?? [], harvests: (harvestsQ.data ?? []).filter(batch => batch.status !== 'DRAFT'), metricsByZone,
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
  // Lỗi phần phụ thì coi là lỗi cả trang, không hiện sai "0 cảnh báo"
  const isError = farmsQ.isError || housesQ.error || zonesQ.error || sensorsQ.isError
    || camerasQ.isError || alertsQ.isError || (canViewHarvest && harvestsQ.isError)

  return {
    structure, isLoading, isError,
    // Số đo trung bình đang tải: card hiện "--" thay vì chặn cả trang
    metricsLoading: envQ.isLoading,
    // Có quyền xem thu hoạch không: role không có quyền thì UI ẩn mọi khối sản lượng thay vì hiện 0
    canViewHarvest,
    // Tải lại mọi nguồn của cây, kể cả houses/zones (useQueries không có refetch chung)
    refetch: () => {
      for (const key of ['farms', 'houses', 'zones', 'sensor-nodes', 'camera-nodes', 'alerts']) void queryClient.refetchQueries({ queryKey: [key] })
      if (canViewHarvest) void harvestsQ.refetch()
    },
  }
}

export interface HouseStaff { name: string; initials: string }

// "Phụ trách" của mỗi nhà: thợ chính, tên tra trong thành viên farm: chỉ Farm Owner nhận được tên
export function useHouseStaff(houses: House[]): Map<string, HouseStaff> {
  const farmIds = useMemo(() => [...new Set(houses.map(house => house.farm_id))], [houses])
  const farms = useFarmDetails(farmIds)
  return useMemo(() => {
    const nameById = new Map<string, string>()
    for (const farm of farms) for (const member of farm.members) nameById.set(member.user_id, member.full_name ?? member.email ?? '')
    const staffByHouse = new Map<string, HouseStaff>()
    for (const house of houses) {
      const primary = house.technicians?.find(item => item.primary)
      const name = primary ? nameById.get(primary.user_id) : undefined
      if (name) staffByHouse.set(house._id, { name, initials: (name.trim().split(/\s+/).pop() ?? name).charAt(0).toUpperCase() })
    }
    return staffByHouse
  }, [farms, houses])
}

const NO_IDS: string[] = []

// Dùng cache ['zones', houseId] để biết zone nào cần join socket
export function useHouseZoneIds(houseId: string | undefined): string[] {
  const { data } = useQuery({
    queryKey: ['zones', houseId],
    queryFn: () => farmApi.listZones(houseId!).then(r => r.data.data),
    enabled: !!houseId,
    staleTime: STRUCTURE_STALE_MS,
  })
  return useMemo(() => data?.map(z => z._id) ?? NO_IDS, [data])
}
