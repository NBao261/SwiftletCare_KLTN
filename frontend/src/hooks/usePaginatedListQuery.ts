import { useQuery } from '@tanstack/react-query'
import type { ApiResponse } from '@/types'

/**
 * Unwrap chung envelope phân trang `{success,data:{data,meta:{total,page,limit}}}` — trước đây
 * bị viết lại y hệt ở `useAlertsList`/`useTicketsList`. Dùng cho mọi danh sách phân trang.
 * Tham số `queryOptions` tùy chọn: truyền `enabled`, `staleTime`, v.v. xuống `useQuery`.
 */
export function usePaginatedListQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<{ data: ApiResponse<T[]> }>,
  fallbackPage = 1,
  fallbackLimit = 20,
  queryOptions?: { enabled?: boolean; staleTime?: number; refetchInterval?: number },
) {
  const result = useQuery({ queryKey, queryFn, ...queryOptions })
  return {
    records: result.data?.data.data ?? [],
    total: result.data?.data.meta?.total ?? 0,
    page: result.data?.data.meta?.page ?? fallbackPage,
    limit: result.data?.data.meta?.limit ?? fallbackLimit,
    isLoading: result.isLoading,
  }
}
