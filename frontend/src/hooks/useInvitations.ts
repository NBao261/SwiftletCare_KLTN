import { useQuery, useMutation } from '@tanstack/react-query'
import { invitationApi } from '@/services/api'

/** AUTH-FR-010, Flow 12 — xem trước lời mời qua token, không cần đăng nhập */
export function useInvitationPreview(token: string | undefined) {
  return useQuery({
    queryKey: ['invitation', token],
    queryFn: () => invitationApi.getByToken(token!).then(r => r.data.data),
    enabled: !!token,
    retry: false,
  })
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (token: string) => invitationApi.accept(token),
  })
}

export function useDeclineInvitation() {
  return useMutation({
    mutationFn: (token: string) => invitationApi.decline(token),
  })
}
