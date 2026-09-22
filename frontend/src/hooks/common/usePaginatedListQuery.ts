import { useQuery } from '@tanstack/react-query'
import type { ApiResponse } from '@/types'

/**
 * Unwrap chung envelope phân trang `{success,data:{data,meta:{total,page,limit}}}` — trước đây
 * bị viết lại y hệt ở `useAlertsList`/`useTicketsList`. Dùng cho mọi danh sách phân trang.
 */
export function usePaginatedListQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<{ data: ApiResponse<T[]> }>,
  fallbackPage = 1,
  fallbackLimit = 20,
) {
  const result = useQuery({ queryKey, queryFn })
  return {
    records: result.data?.data.data ?? [],
    total: result.data?.data.meta?.total ?? 0,
    page: result.data?.data.meta?.page ?? fallbackPage,
    limit: result.data?.data.meta?.limit ?? fallbackLimit,
    isLoading: result.isLoading,
  }
}
