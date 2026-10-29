import api from '@/lib/axios'
import type { ApiResponse, Invitation, Farm, User } from '@/types'

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
  accept:     (token: string) => api.post<ApiResponse<Farm>>(`/invitations/${token}/accept`),
  /** Người được mời chưa có tài khoản: chỉ đặt tên + mật khẩu, email và role lấy từ lời mời. Không trả token → đăng nhập sau */
  createAccount: (token: string, input: { full_name: string; password: string }) =>
    api.post<ApiResponse<User>>(`/invitations/${token}/create-account`, input),
  decline:    (token: string) => api.post<ApiResponse<{ message: string }>>(`/invitations/${token}/decline`),
}
