import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/apis/admin/users.api'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'
import type { User } from '@/types'

export interface QueuePageQuery { page?: number; limit?: number }

// GET /admin/delete-requests: user có deletion_requested_at, cũ nhất trước (hạn 30 ngày), phân trang server.
export function useDeleteRequestsList(query: QueuePageQuery = {}) {
  return usePaginatedListQuery<User>(
    ['admin-delete-requests', query],
    () => adminApi.listDeleteRequests(query),
    query.page,
    query.limit,
  )
}

// Badge "Người dùng": số yêu cầu xoá đang chờ; khoá theo tiền tố 'admin-delete-requests' nên tự giảm khi xử lý xong
export function usePendingDeletionCount(enabled: boolean): number {
  const { data } = useQuery({
    queryKey: ['admin-delete-requests', 'count'],
    queryFn: () => adminApi.listDeleteRequests({ limit: 1 }),
    enabled,
    // Như các badge menu khác: làm mới 2 phút một lần, không cần sát từng giây
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
  return data?.data.meta?.total ?? 0
}

// PUT /admin/delete-requests/:id/complete: backend tự cascade (chuyển owner / soft-delete farm / ẩn danh PII).
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

// PUT /admin/delete-requests/:id/reject: tài khoản về ACTIVE, lý do bắt buộc.
export function useRejectDeleteRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminApi.rejectDeleteRequest(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-delete-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}

