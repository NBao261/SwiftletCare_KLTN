import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/apis/admin/users.api'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'
import type { User } from '@/types'

export interface QueuePageQuery { page?: number; limit?: number }

/** AUTH-FR-012, Flow 19 — GET /admin/delete-requests: user có deletion_requested_at, cũ nhất trước (hạn 30 ngày), phân trang server. */
export function useDeleteRequestsList(query: QueuePageQuery = {}) {
  return usePaginatedListQuery<User>(
    ['admin-delete-requests', query],
    () => adminApi.listDeleteRequests(query),
    query.page,
    query.limit,
  )
}

/**
 * PUT /admin/delete-requests/:id/complete — backend tự cascade (chuyển owner /
 * soft-delete farm / ẩn danh PII).
 */
export function useCompleteDeleteRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.completeDeleteRequest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-delete-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}

