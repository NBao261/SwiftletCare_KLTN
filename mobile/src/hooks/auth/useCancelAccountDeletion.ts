import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/services/api/auth.api'
import { useAuthStore } from '@/stores/authStore'

// Huỷ yêu cầu xoá tài khoản đang chờ (DELETE /auth/delete-request, AUTH-FR-012, §6.14 DELETION_REQUESTED → ACTIVE)
export function useCancelAccountDeletion() {
  const updateUser = useAuthStore(state => state.updateUser)

  return useMutation({
    retry: false,
    mutationFn: () => authApi.cancelDeletion(),
    onSuccess: () => updateUser({ deletion_requested_at: null }),
  })
}
