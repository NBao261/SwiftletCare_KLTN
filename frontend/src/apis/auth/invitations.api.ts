import api from '@/lib/axios'
import type { ApiResponse, Invitation, Farm, User } from '@/types'

export interface InvitationPreview {
  invitation: Invitation
  farm: Pick<Farm, '_id' | 'name' | 'address'> | null
  userExists: boolean
}

// Router riêng vì xem trước, từ chối lời mời là link công khai, không cần đăng nhập
export const invitationApi = {
  getByToken: (token: string) => api.get<ApiResponse<InvitationPreview>>(`/invitations/${token}`),
  accept:     (token: string) => api.post<ApiResponse<Farm>>(`/invitations/${token}/accept`),
  // Email và role lấy từ lời mời; không trả token, phải đăng nhập sau
  createAccount: (token: string, input: { full_name: string; password: string }) =>
    api.post<ApiResponse<User>>(`/invitations/${token}/create-account`, input),
  decline:    (token: string) => api.post<ApiResponse<{ message: string }>>(`/invitations/${token}/decline`),
}
