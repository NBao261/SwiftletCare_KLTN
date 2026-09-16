import api from './client'
import type { ApiResponse, Invitation, Farm } from '@/types'

export interface InvitationPreview {
  invitation: Invitation
  farm: Pick<Farm, '_id' | 'name' | 'address'> | null
  userExists: boolean
}

/**
 * AUTH-FR-010, Flow 12 — router riêng `/invitations` (không mount dưới `/farms`)
 * vì xem trước/từ chối lời mời là link công khai qua token, không cần đăng nhập.
 */
export const invitationApi = {
  getByToken: (token: string) => api.get<ApiResponse<InvitationPreview>>(`/invitations/${token}`),
  accept:     (token: string) => api.post<ApiResponse<Farm | { salesAssignment: true }>>(`/invitations/${token}/accept`),
  decline:    (token: string) => api.post<ApiResponse<{ message: string }>>(`/invitations/${token}/decline`),
}
