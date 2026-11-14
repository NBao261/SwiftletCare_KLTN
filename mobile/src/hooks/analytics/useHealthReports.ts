import { useInfiniteQuery } from '@tanstack/react-query'
import { healthReportApi } from '@/services/api/healthReport.api'
import type { HouseHealthReportKind } from '@/types'

const PAGE_SIZE = 10

// Báo cáo sức khỏe của một nhà theo loại kỳ, mới nhất trước (EXPERT-FR-005); tải thêm theo trang bằng meta.total
export function useHealthReports(houseId: string, kind: HouseHealthReportKind, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['health-reports', 'house', houseId, kind],
    queryFn: ({ pageParam }) =>
      healthReportApi
        .listHouseReports({ houseId, kind, page: pageParam, limit: PAGE_SIZE })
        .then(response => response.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.data.length, 0)
      return loaded < (lastPage.meta?.total ?? 0) ? pages.length + 1 : undefined
    },
    enabled: enabled && Boolean(houseId),
  })
}
