import { useInfiniteQuery } from '@tanstack/react-query'
import { healthReportApi } from '@/services/api/healthReport.api'

const PAGE_SIZE = 10

// Báo cáo tuần của một tầng, kỳ mới nhất trước (EXPERT-FR-005); tải thêm theo trang bằng meta.total
export function useHealthReports(zoneId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['health-reports', 'zone', zoneId],
    queryFn: ({ pageParam }) => healthReportApi.list(zoneId, pageParam, PAGE_SIZE).then(response => response.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((total, page) => total + page.data.length, 0)
      return loaded < (lastPage.meta?.total ?? 0) ? pages.length + 1 : undefined
    },
    enabled: enabled && Boolean(zoneId),
  })
}
