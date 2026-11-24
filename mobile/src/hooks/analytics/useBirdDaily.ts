import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/services/api/analytics.api'
import { getDayWindows } from '@/utils/analytics.utils'

// Số đếm từng ngày của nhà cho kỳ này và kỳ trước cùng độ dài (một request gấp đôi khoảng), để so sánh tỉ lệ về tổ.
// today (YYYY-MM-DD giờ Việt Nam) nằm trong khoá để qua ngày mới thì tải lại
export function useBirdDaily(houseId: string, days: number, today: string) {
  return useQuery({
    queryKey: ['analytics', 'bird-daily', houseId, days, today],
    queryFn: async () => {
      const windows = getDayWindows(days, Date.now())
      const response = await analyticsApi.getBirdCountDaily(houseId, windows.previous.from, windows.current.to)
      const firstCurrentDate = windows.current.from
      const records = response.data.data.records
      // Ngày của bản ghi là ngày giờ Việt Nam; kỳ này bắt đầu từ ngày của mốc current.from
      const boundary = new Date(Date.parse(firstCurrentDate) + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
      return {
        current: records.filter(record => record.date >= boundary),
        previous: records.filter(record => record.date < boundary),
      }
    },
    enabled: Boolean(houseId),
    placeholderData: keepPreviousData,
  })
}
