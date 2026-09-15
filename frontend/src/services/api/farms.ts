import api from './client'
import type { ApiResponse, Farm, House, Zone } from '@/types'

export const farmApi = {
  list:   () => api.get<ApiResponse<Farm[]>>('/farms'),
  create: (input: { name: string; address: string; coordinates?: { lat: number; lng: number } }) =>
    api.post<ApiResponse<Farm>>('/farms', input),
  getOne: (id: string) => api.get<ApiResponse<Farm>>(`/farms/${id}`),
  update: (id: string, input: Partial<{ name: string; address: string }>) =>
    api.put<ApiResponse<Farm>>(`/farms/${id}`, input),
  remove: (id: string) => api.delete<ApiResponse<{ message: string }>>(`/farms/${id}`),
  inviteMember: (id: string, email: string) =>
    api.post<ApiResponse<Farm>>(`/farms/${id}/members`, { email }),

  createHouse: (farmId: string, input: { name: string; floors?: number; description?: string }) =>
    api.post<ApiResponse<House>>(`/farms/${farmId}/houses`, input),
  listHouses: (farmId: string) => api.get<ApiResponse<House[]>>(`/farms/${farmId}/houses`),

  createZone: (houseId: string, input: { name: string; floor?: number }) =>
    api.post<ApiResponse<Zone>>(`/farms/houses/${houseId}/zones`, input),
  listZones: (houseId: string) => api.get<ApiResponse<Zone[]>>(`/farms/houses/${houseId}/zones`),

  updateThresholds: (zoneId: string, thresholds: Partial<Zone['thresholds']>) =>
    api.put<ApiResponse<Zone>>(`/farms/zones/${zoneId}/thresholds`, thresholds),
}
