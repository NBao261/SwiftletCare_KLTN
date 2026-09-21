import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/services/api'
import { usePaginatedListQuery } from './usePaginatedListQuery'
import type { SalesAssignmentRequest, User } from '@/types'

export interface QueuePageQuery { page?: number; limit?: number }

/** AUTH-FR-012, Flow 19 — GET /admin/delete-requests: user có deletion_requested_at, cũ nhất trước (SLA 30 ngày), phân trang server. */
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
 * soft-delete farm / ẩn danh PII). Trả 409 HAS_OPEN_TICKETS khi còn ticket mở và
 * không `force` — UI bắt mã này để hỏi lại (Flow 19 bước 7c).
 */
export function useCompleteDeleteRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => adminApi.completeDeleteRequest(id, force),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-delete-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}

/** AUTH-FR-005d, Flow 16 bước 1b/1e — GET /admin/sales-staff-requests?status=PENDING (cả ADD lẫn REMOVE), phân trang server. */
export function useSalesAssignmentRequestsList(query: QueuePageQuery = {}) {
  return usePaginatedListQuery<SalesAssignmentRequest>(
    ['admin-sales-assignment-requests', query],
    () => adminApi.listSalesStaffRequests({ status: 'PENDING', ...query }),
    query.page,
    query.limit,
  )
}

export function useDecideSalesAssignmentRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: Exclude<SalesAssignmentRequest['status'], 'PENDING'>; reason?: string }) =>
      adminApi.decideSalesStaffRequest(id, decision, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-sales-assignment-requests'] })
      // Duyệt ADD có thể tạo tài khoản Sales Staff mới → bảng người dùng đổi
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}
