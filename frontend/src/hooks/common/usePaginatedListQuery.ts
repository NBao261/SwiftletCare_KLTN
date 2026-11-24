import { useQuery, type keepPreviousData } from '@tanstack/react-query'
import type { ApiResponse } from '@/types'

// Unwrap envelope phân trang dùng chung
export function usePaginatedListQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<{ data: ApiResponse<T[]> }>,
  fallbackPage = 1,
  fallbackLimit = 20,
  queryOptions?: { enabled?: boolean; staleTime?: number; refetchInterval?: number; placeholderData?: typeof keepPreviousData },
) {
  const result = useQuery({ queryKey, queryFn, ...queryOptions })
  return {
    records: result.data?.data.data ?? [],
    total: result.data?.data.meta?.total ?? 0,
    page: result.data?.data.meta?.page ?? fallbackPage,
    limit: result.data?.data.meta?.limit ?? fallbackLimit,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch,
  }
}
