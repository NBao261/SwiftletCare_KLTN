import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/services/api/auth.api'
import { useAuthStore } from '@/stores/authStore'

// Gửi yêu cầu xoá tài khoản và dữ liệu cá nhân (POST /auth/delete-request, AUTH-FR-012); Admin xử lý trong 30 ngày.
// Backend chỉ trả câu báo, nên ghi mốc gửi vào phiên đang lưu để màn hiện trạng thái chờ ngay (User.deletion_requested_at)
export function useRequestAccountDeletion() {
  const updateUser = useAuthStore(state => state.updateUser)

  return useMutation({
    retry: false,
    mutationFn: () => authApi.requestDeletion(),
    onSuccess: () => updateUser({ deletion_requested_at: new Date().toISOString() }),
  })
}
