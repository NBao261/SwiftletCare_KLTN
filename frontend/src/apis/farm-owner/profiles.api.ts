// EXPERT-FR-015 — Farm Owner xem hồ sơ cấu hình đã duyệt và áp cho các nhà (soạn, duyệt ở apis/domain-expert/profiles.api.ts)
import api from '@/lib/axios'
import type { ApiResponse, ConfigProfile } from '@/types'

export interface ProfileApplyResult {
  profile_id: string
  zones: Array<{ zone_id: string; house_id: string; name: string; config_version: number }>
}

export const ownerProfilesApi = {
  listApproved: (farmId: string) =>
    api.get<ApiResponse<ConfigProfile[]>>('/profiles', { params: { farmId, status: 'APPROVED', limit: 100 } }),
  apply: (profileId: string, houseIds: string[]) =>
    api.post<ApiResponse<ProfileApplyResult>>(`/profiles/${profileId}/apply`, { house_ids: houseIds }),
}
