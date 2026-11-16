// EXPERT-FR-014, 015 — Hồ sơ cấu hình (config profiles)
import api from '@/lib/axios'
import type { ApiResponse } from '@/types'
import type { ConfigProfile, ConfigProfileInput } from '@/types/expert.types'

export const profilesApi = {
  list: (farmId: string, status?: string) =>
    api.get<ApiResponse<ConfigProfile[]>>('/profiles', { params: { farmId, ...(status ? { status } : {}) } }),

  getOne: (id: string) =>
    api.get<ApiResponse<ConfigProfile>>(`/profiles/${id}`),

  create: (farmId: string, input: ConfigProfileInput) =>
    api.post<ApiResponse<ConfigProfile>>('/profiles', { farm_id: farmId, ...input }),

  update: (id: string, input: ConfigProfileInput) =>
    api.put<ApiResponse<ConfigProfile>>(`/profiles/${id}`, input),

  approve: (id: string) =>
    api.post<ApiResponse<ConfigProfile>>(`/profiles/${id}/approve`),

  archive: (id: string) =>
    api.post<ApiResponse<ConfigProfile>>(`/profiles/${id}/archive`),
}
