import api from '@/lib/axios'
import type { ApiResponse, Farm, FarmMemberRole, Coordinates, House, HouseStage, RosterShift, Zone, Invitation } from '@/types'

export const farmApi = {
  list:   () => api.get<ApiResponse<Farm[]>>('/farms'),
  create: (input: { name: string; address: string; coordinates: Coordinates }) =>
    api.post<ApiResponse<Farm>>('/farms', input),
  getOne: (id: string) => api.get<ApiResponse<Farm>>(`/farms/${id}`),
  update: (id: string, input: Partial<{ name: string; address: string; coordinates: Coordinates }>) =>
    api.put<ApiResponse<Farm>>(`/farms/${id}`, input),
  remove: (id: string) => api.delete<ApiResponse<{ message: string }>>(`/farms/${id}`),

  // mời thành viên qua Invitation (không còn thêm thẳng vào members)
  inviteMember: (id: string, email: string, role?: FarmMemberRole) =>
    api.post<ApiResponse<Invitation>>(`/farms/${id}/members`, role ? { email, role } : { email }),
  removeMember: (id: string, userId: string) =>
    api.delete<ApiResponse<Farm>>(`/farms/${id}/members/${userId}`),
  // lời mời của farm (chỉ Primary Owner), mặc định những lời mời đang chờ
  listInvitations: (id: string, status: Invitation['status'] = 'PENDING') =>
    api.get<ApiResponse<Invitation[]>>(`/farms/${id}/invitations`, { params: { status, limit: 100 } }),

  createHouse: (farmId: string, input: { name: string; floors?: number; description?: string }) =>
    api.post<ApiResponse<House>>(`/farms/${farmId}/houses`, input),
  listHouses: (farmId: string) => api.get<ApiResponse<House[]>>(`/farms/${farmId}/houses`),
  // đổi tên, số tầng, mô tả; xoá mềm (409 HAS_ACTIVE_DEVICES khi còn thiết bị đang dùng)
  updateHouse: (houseId: string, input: { name?: string; floors?: number; description?: string }) =>
    api.put<ApiResponse<House>>(`/farms/houses/${houseId}`, input),
  deleteHouse: (houseId: string) => api.delete<ApiResponse<null>>(`/farms/houses/${houseId}`),
  // gán / bỏ gán Farm Technician vào nhà; gọi lại PUT với người đã gán chỉ đổi primary
  assignTechnician: (houseId: string, userId: string, primary: boolean) =>
    api.put<ApiResponse<House>>(`/farms/houses/${houseId}/technicians/${userId}`, { primary }),
  unassignTechnician: (houseId: string, userId: string) =>
    api.delete<ApiResponse<House>>(`/farms/houses/${houseId}/technicians/${userId}`),
  // lịch trực của nhà; PUT thay cả lịch (mảng rỗng = bỏ lịch)
  getRoster: (houseId: string) =>
    api.get<ApiResponse<{ house_id: string; roster: RosterShift[] }>>(`/farms/houses/${houseId}/roster`),
  setRoster: (houseId: string, shifts: RosterShift[]) =>
    api.put<ApiResponse<{ house_id: string; roster: RosterShift[] }>>(`/farms/houses/${houseId}/roster`, { shifts }),

  // đặt giai đoạn nhà (Farm Owner, Domain Expert của farm)
  setHouseStage: (houseId: string, stage: HouseStage) =>
    api.put<ApiResponse<House>>(`/farms/houses/${houseId}/stage`, { stage }),

  createZone: (houseId: string, input: { name: string; floor?: number }) =>
    api.post<ApiResponse<Zone>>(`/farms/houses/${houseId}/zones`, input),
  listZones: (houseId: string) => api.get<ApiResponse<Zone[]>>(`/farms/houses/${houseId}/zones`),
  getZone: (zoneId: string) => api.get<ApiResponse<Zone>>(`/farms/zones/${zoneId}`),
  // đổi tên, tầng; xoá mềm (409 HAS_ACTIVE_DEVICES khi còn bộ điều khiển đang dùng)
  updateZone: (zoneId: string, input: { name?: string; floor?: number }) =>
    api.put<ApiResponse<Zone>>(`/farms/zones/${zoneId}`, input),
  deleteZone: (zoneId: string) => api.delete<ApiResponse<null>>(`/farms/zones/${zoneId}`),
}
