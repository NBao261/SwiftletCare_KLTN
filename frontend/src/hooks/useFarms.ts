import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api'
import type { Zone } from '@/types'

export function useFarms() {
  return useQuery({
    queryKey: ['farms'],
    queryFn: () => farmApi.list().then(r => r.data.data),
  })
}

/** Chi tiết farm — đã populate tên/email owner/members (farm.service.ts getFarm) */
export function useFarm(farmId: string | undefined) {
  return useQuery({
    queryKey: ['farms', farmId],
    queryFn: () => farmApi.getOne(farmId!).then(r => r.data.data),
    enabled: !!farmId,
  })
}

export function useCreateFarm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; address: string; region?: string }) => farmApi.create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['farms'] }),
  })
}

export function useHouses(farmId: string | undefined) {
  return useQuery({
    queryKey: ['houses', farmId],
    queryFn: () => farmApi.listHouses(farmId!).then(r => r.data.data),
    enabled: !!farmId,
  })
}

export function useCreateHouse(farmId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; floors?: number }) => farmApi.createHouse(farmId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['houses', farmId] }),
  })
}

export function useZones(houseId: string | undefined) {
  return useQuery({
    queryKey: ['zones', houseId],
    queryFn: () => farmApi.listZones(houseId!).then(r => r.data.data),
    enabled: !!houseId,
  })
}

export function useCreateZone(houseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; floor?: number }) => farmApi.createZone(houseId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['zones', houseId] }),
  })
}

export function useZone(zoneId: string | undefined) {
  return useQuery({
    queryKey: ['zone', zoneId],
    queryFn: () => farmApi.getZone(zoneId!).then(r => r.data.data),
    enabled: !!zoneId,
  })
}

export function useUpdateThresholds(zoneId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (thresholds: Partial<Zone['thresholds']>) => farmApi.updateThresholds(zoneId, thresholds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['zones'] })
      void queryClient.invalidateQueries({ queryKey: ['zone', zoneId] })
    },
  })
}

/** ENV-FR-020 */
export function useResetThresholds(zoneId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => farmApi.resetThresholds(zoneId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['zones'] })
      void queryClient.invalidateQueries({ queryKey: ['zone', zoneId] })
    },
  })
}

// ── Thành viên & Sales Staff (AUTH-FR-005/005b/010) ─────────────────────────

export function useInviteMember(farmId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => farmApi.inviteMember(farmId, email),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['farms', farmId] }),
  })
}

export function useRemoveMember(farmId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => farmApi.removeMember(farmId, userId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['farms', farmId] }),
  })
}

export function useInviteSalesStaff(farmId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => farmApi.inviteSalesStaff(farmId, email),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sales-staff', farmId] }),
  })
}

export function useSalesStaff(farmId: string | undefined) {
  return useQuery({
    queryKey: ['sales-staff', farmId],
    queryFn: () => farmApi.listSalesStaff(farmId!).then(r => r.data.data),
    enabled: !!farmId,
  })
}

// ── Zone phẳng của 1 Farm (chọn Farm→Zone gọn trong form, xem ZonePicker) ───

export interface FlatZone extends Zone { houseName: string }

/**
 * Gộp `listHouses` + `listZones` từng house thành 1 danh sách Zone phẳng của
 * Farm — dùng cho `ZonePicker` (tạo Harvest/Ticket) và để resolve tên zone
 * trong danh sách Harvest/Ticket (API đó chỉ trả `zone_id` thô).
 */
export function useFarmZones(farmId: string | undefined) {
  return useQuery({
    queryKey: ['farm-zones', farmId],
    queryFn: async () => {
      const houses = (await farmApi.listHouses(farmId!)).data.data
      const perHouse = await Promise.all(
        houses.map(house => farmApi.listZones(house._id).then(r => r.data.data.map(z => ({ ...z, houseName: house.name })))),
      )
      return perHouse.flat() as FlatZone[]
    },
    enabled: !!farmId,
    // House/Zone hiếm khi đổi cấu trúc — tránh request N+1 (listHouses + listZones
    // từng house) lặp lại theo staleTime toàn cục 30s ở cả 3 nơi gọi hook này.
    staleTime: 5 * 60 * 1000,
  })
}

export interface AllZone extends Zone { houseName: string; farmId: string; farmName: string }

/**
 * Zone phẳng của TẤT CẢ farm user đang có quyền xem — dùng cho chế độ "Tất cả"
 * của ZoneSwitcher (Dashboard hiện lưới tổng quan mọi zone thay vì bắt chọn 1
 * zone trước). Không có endpoint backend gộp sẵn nên gọi listHouses/listZones
 * lặp qua từng farm ở client — chấp nhận được vì phần lớn tài khoản chỉ có 1-2
 * farm (xem comment ZoneSwitcher).
 */
export function useAllZones() {
  const { data: farms } = useFarms()
  return useQuery({
    queryKey: ['all-zones', farms?.map(f => f._id)],
    queryFn: async () => {
      const perFarm = await Promise.all(
        (farms ?? []).map(async farm => {
          const houses = (await farmApi.listHouses(farm._id)).data.data
          const perHouse = await Promise.all(
            houses.map(house =>
              farmApi.listZones(house._id).then(r =>
                r.data.data.map(z => ({ ...z, houseName: house.name, farmId: farm._id, farmName: farm.name })),
              ),
            ),
          )
          return perHouse.flat()
        }),
      )
      return perFarm.flat() as AllZone[]
    },
    enabled: !!farms,
    staleTime: 5 * 60 * 1000,
  })
}
