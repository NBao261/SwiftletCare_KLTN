import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => invitationApi.accept(token),
    onSuccess: (_data, token) => void queryClient.invalidateQueries({ queryKey: ['invitation', token] }),
  })
}

export function useDeclineInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => invitationApi.decline(token),
    onSuccess: (_data, token) => void queryClient.invalidateQueries({ queryKey: ['invitation', token] }),
  })
}
