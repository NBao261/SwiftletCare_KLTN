import { useQueries, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/apis/shared/farms.api'
import type { Coordinates, HouseStage, Zone, FarmMemberRole, RosterShift } from '@/types'

const isMongoId = (id: string | undefined): boolean => Boolean(id && /^[0-9a-fA-F]{24}$/.test(id))

export function useFarms() {
  return useQuery({
    queryKey: ['farms'],
    queryFn: () => farmApi.list().then(response => response.data.data),
  })
}

/** Chi tiết farm — đã populate tên/email owner/members (farm.service.ts getFarm) */
export function useFarm(farmId: string | undefined) {
  return useQuery({
    queryKey: ['farms', farmId],
    queryFn: () => farmApi.getOne(farmId!).then(response => response.data.data),
    enabled: isMongoId(farmId),
  })
}

// Chi tiết nhiều farm cùng lúc (chung cache ['farms', id] với useFarm), VD tra tên người nhập đợt thu của mọi farm
export function useFarmDetails(farmIds: string[]) {
  return useQueries({
    queries: farmIds.map(farmId => ({
      queryKey: ['farms', farmId],
      queryFn: () => farmApi.getOne(farmId).then(response => response.data.data),
    })),
    combine: results => results.flatMap(result => (result.data ? [result.data] : [])),
  })
}

export function useCreateFarm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; address: string; coordinates: Coordinates }) => farmApi.create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['farms'] }),
  })
}

// FARM-FR-001 — sửa tên, địa chỉ, vị trí farm
export function useUpdateFarm(farmId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<{ name: string; address: string; coordinates: Coordinates }>) => farmApi.update(farmId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['farms'] }),
  })
}

// FARM-FR-001 — xoá mềm farm (chỉ Primary Owner); backend đóng cảnh báo đang mở của farm
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
    queryFn: () => farmApi.listHouses(farmId!).then(response => response.data.data),
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

// FARM-FR-002 — đổi tên hoặc xoá nhà, Zone; xong thì làm mới cấu trúc farm (nhà, Zone, thiết bị, cảnh báo đã đóng theo)
export function useEditStructure() {
  const queryClient = useQueryClient()
  const refresh = () => Promise.all(['farms', 'houses', 'zones', 'farm-zones', 'all-zones', 'sensor-nodes', 'alerts', 'work-orders', 'maintenance', 'recommendations'].map(key =>
    queryClient.invalidateQueries({ queryKey: [key] })))
  type Target = { kind: 'house' | 'zone'; id: string }
  const rename = useMutation({
    // Trang dùng cấu trúc tải lại, không dùng bản trả về nên bỏ kiểu House / Zone
    mutationFn: async ({ kind, id, name }: Target & { name: string }): Promise<void> => {
      await (kind === 'house' ? farmApi.updateHouse(id, { name }) : farmApi.updateZone(id, { name }))
    },
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: async ({ kind, id }: Target): Promise<void> => {
      await (kind === 'house' ? farmApi.deleteHouse(id) : farmApi.deleteZone(id))
    },
    onSuccess: refresh,
  })
  return { rename, remove }
}

// FARM-FR-014 — đổi giai đoạn nhà rồi làm mới danh sách nhà (mọi trang đọc giai đoạn từ đó)
export function useSetHouseStage(houseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (stage: HouseStage) => farmApi.setHouseStage(houseId, stage),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['houses'] }),
  })
}

export function useZones(houseId: string | undefined) {
  return useQuery({
    queryKey: ['zones', houseId],
    queryFn: () => farmApi.listZones(houseId!).then(response => response.data.data),
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
    queryFn: () => farmApi.getZone(zoneId!).then(response => response.data.data),
    enabled: isMongoId(zoneId),
  })
}

// ── Thành viên farm (AUTH-FR-005/010, EXPERT-FR-001) ─────────────────────────

// AUTH-FR-005, EXPERT-FR-001 — mời đồng sở hữu (FARM_OWNER) hoặc chuyên gia (DOMAIN_EXPERT) qua POST /farms/:id/members
export function useInviteFarmMember(farmId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { email: string; role: FarmMemberRole }) => farmApi.inviteMember(farmId, input.email, input.role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['farms', farmId] })
      void queryClient.invalidateQueries({ queryKey: ['invitations', farmId] })
    },
  })
}

// AUTH-FR-010 — lời mời đang chờ của farm; route chỉ cho Primary Owner nên role khác không gọi
export function useFarmInvitations(farmId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['invitations', farmId],
    queryFn: () => farmApi.listInvitations(farmId).then(response => response.data.data),
    enabled: enabled && isMongoId(farmId),
  })
}

export function useRemoveMember(farmId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => farmApi.removeMember(farmId, userId),
    // Gỡ thợ khỏi farm thì backend bỏ luôn các lần giao nhà và ca trực của người đó
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['farms', farmId] })
      void queryClient.invalidateQueries({ queryKey: ['houses', farmId] })
      void queryClient.invalidateQueries({ queryKey: ['roster'] })
    },
  })
}

// AUTH-FR-013 — bật/tắt giao nhà cho 1 Farm Technician, đổi thợ chính (primary: true đẩy thợ chính cũ thành thợ phụ)
export function useSetHouseTechnician(farmId: string, houseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { userId: string; assigned: boolean; primary?: boolean }) => (input.assigned
      ? farmApi.assignTechnician(houseId, input.userId, input.primary ?? false)
      : farmApi.unassignTechnician(houseId, input.userId)),
    // Bỏ giao nhà thì backend bỏ luôn các ca trực của thợ đó
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['houses', farmId] })
      void queryClient.invalidateQueries({ queryKey: ['roster', houseId] })
    },
  })
}

// AUTH-FR-014 — lịch trực của 1 nhà (Farm Owner, Domain Expert xem cả lịch)
export function useHouseRoster(houseId: string | undefined) {
  return useQuery({
    queryKey: ['roster', houseId],
    queryFn: () => farmApi.getRoster(houseId!).then(response => response.data.data.roster),
    enabled: isMongoId(houseId),
  })
}

// Thay cả lịch trực của nhà: thêm, sửa, xoá 1 ca đều gửi lại toàn bộ
export function useSetHouseRoster(houseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (shifts: RosterShift[]) => farmApi.setRoster(houseId, shifts),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['roster', houseId] }),
  })
}

// ── Zone phẳng của 1 Farm (kèm tên nhà) ───────────────────────────────────

export interface FlatZone extends Zone { houseName: string }

// Zone phẳng của 1 farm (kèm tên nhà) để tra tên Zone, nhà cho Harvest vốn chỉ trả zone_id
export function useFarmZones(farmId: string | undefined) {
  return useQuery({
    queryKey: ['farm-zones', farmId],
    queryFn: async () => {
      const houses = (await farmApi.listHouses(farmId!)).data.data
      const perHouse = await Promise.all(
        houses.map(house => farmApi.listZones(house._id).then(response => response.data.data.map(zone => ({ ...zone, houseName: house.name })))),
      )
      return perHouse.flat() as FlatZone[]
    },
    enabled: isMongoId(farmId),
    // Cấu trúc nhà / Zone hiếm đổi: giữ 5 phút để không lặp request N+1 theo staleTime chung 30 giây
    staleTime: 5 * 60 * 1000,
  })
}

export interface AllZone extends Zone { houseName: string; farmId: string; farmName: string }

// Nhà và Zone cùng khoá cache với useFarmStructure, useScopeFilter: mỗi nhà chỉ gọi 1 lần dù nhiều hook cùng cần (A-14)
const STRUCTURE_STALE_MS = 5 * 60 * 1000

// Zone phẳng của mọi farm tài khoản xem được; backend không có API gộp nên gọi listHouses / listZones từng farm ở client
export function useAllZones() {
  const { data: farms } = useFarms()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['all-zones', farms?.map(farm => farm._id)],
    queryFn: async () => {
      const perFarm = await Promise.all(
        (farms ?? []).map(async farm => {
          const houses = await queryClient.fetchQuery({
            queryKey: ['houses', farm._id],
            queryFn: () => farmApi.listHouses(farm._id).then(response => response.data.data),
            staleTime: STRUCTURE_STALE_MS,
          })
          const perHouse = await Promise.all(
            houses.map(house =>
              queryClient.fetchQuery({
                queryKey: ['zones', house._id],
                queryFn: () => farmApi.listZones(house._id).then(response => response.data.data),
                staleTime: STRUCTURE_STALE_MS,
              }).then(zones =>
                zones.map(zone => ({ ...zone, houseName: house.name, farmId: farm._id, farmName: farm.name })),
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
