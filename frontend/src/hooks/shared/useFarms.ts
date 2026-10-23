import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/apis/shared/farms.api'
import type { FuzzyTuning, Zone, FarmMemberRole } from '@/types'

const isMongoId = (id: string | undefined): boolean => Boolean(id && /^[0-9a-fA-F]{24}$/.test(id))

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
    enabled: isMongoId(farmId),
  })
}

export function useCreateFarm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; address: string; region?: string }) => farmApi.create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['farms'] }),
  })
}

// FARM-FR-009 — danh mục khu vực, hiếm khi đổi
export function useRegions() {
  return useQuery({
    queryKey: ['farm-regions'],
    queryFn: () => farmApi.listRegions().then(r => r.data.data),
    staleTime: Infinity,
  })
}

// FARM-FR-001 — sửa tên, địa chỉ, khu vực farm (khu vực chỉ Primary Owner/Admin đổi được)
export function useUpdateFarm(farmId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<{ name: string; address: string; region: string }>) => farmApi.update(farmId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['farms'] }),
  })
}

// FARM-FR-001 — xoá mềm farm (chỉ Primary Owner); backend đóng cảnh báo và ticket đang mở của farm
export function useDeleteFarm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (farmId: string) => farmApi.remove(farmId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['farms'] })
      void queryClient.invalidateQueries({ queryKey: ['all-zones'] })
    },
  })
}

export function useHouses(farmId: string | undefined) {
  return useQuery({
    queryKey: ['houses', farmId],
    queryFn: () => farmApi.listHouses(farmId!).then(r => r.data.data),
    enabled: isMongoId(farmId),
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
    enabled: isMongoId(houseId),
  })
}

export function useCreateZone(houseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; floor?: number }) => farmApi.createZone(houseId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['zones', houseId] })
      // 2 danh sách zone phẳng có staleTime 5 phút — không làm mới thì zone mới vắng mặt ở ZonePicker và số zone ở trang Farm
      void queryClient.invalidateQueries({ queryKey: ['farm-zones'] })
      void queryClient.invalidateQueries({ queryKey: ['all-zones'] })
    },
  })
}

export function useZone(zoneId: string | undefined) {
  return useQuery({
    queryKey: ['zone', zoneId],
    queryFn: () => farmApi.getZone(zoneId!).then(r => r.data.data),
    enabled: isMongoId(zoneId),
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

/** ENV-FR-021 — hệ số bộ điều khiển mờ; làm mới cả Zone lẫn biểu đồ hiệu quả điều khiển (vạch mốc lần chỉnh) */
export function useUpdateFuzzyTuning(zoneId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tuning: Partial<FuzzyTuning>) => farmApi.updateFuzzyTuning(zoneId, tuning),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['zone', zoneId] })
      void queryClient.invalidateQueries({ queryKey: ['analytics', 'control-performance', zoneId] })
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

// ── Thành viên farm (AUTH-FR-005/010, EXPERT-FR-001) ─────────────────────────

// AUTH-FR-005, EXPERT-FR-001 — mời đồng sở hữu (FARM_OWNER) hoặc chuyên gia (DOMAIN_EXPERT) qua POST /farms/:id/members
export function useInviteFarmMember(farmId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { email: string; role: FarmMemberRole }) => farmApi.inviteMember(farmId, input.email, input.role),
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

// ── Zone phẳng của 1 Farm (kèm tên nhà) ───────────────────────────────────

export interface FlatZone extends Zone { houseName: string }

/**
 * Gộp `listHouses` + `listZones` từng house thành 1 danh sách Zone phẳng của
 * Farm — dùng để resolve tên zone, tên nhà trong danh sách Harvest/Ticket
 * (API đó chỉ trả `zone_id` thô).
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
    enabled: isMongoId(farmId),
    // House/Zone hiếm khi đổi cấu trúc — tránh request N+1 (listHouses + listZones
    // từng house) lặp lại theo staleTime toàn cục 30s ở cả 3 nơi gọi hook này.
    staleTime: 5 * 60 * 1000,
  })
}

export interface AllZone extends Zone { houseName: string; farmId: string; farmName: string }

/**
 * Zone phẳng của TẤT CẢ farm user đang có quyền xem — dùng cho chế độ "Tất cả"
 * (Dashboard hiện lưới tổng quan mọi zone thay vì bắt chọn 1 zone trước). Không có endpoint backend gộp sẵn nên gọi listHouses/listZones
 * lặp qua từng farm ở client — chấp nhận được vì phần lớn tài khoản chỉ có 1-2
 * farm.
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
    enabled: Boolean(farms && farms.length > 0),
    staleTime: 5 * 60 * 1000,
  })
}
