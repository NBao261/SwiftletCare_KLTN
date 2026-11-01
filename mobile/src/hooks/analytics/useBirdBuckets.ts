import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/services/api/analytics.api'

const DAY_MS = 24 * 60 * 60 * 1000

// Số đếm từng khung 5 phút của một ngày (YYYY-MM-DD giờ Việt Nam) của cả nhà (VISION-FR-017)
export function useBirdBuckets(houseId: string, date: string | null) {
  return useQuery({
    queryKey: ['analytics', 'bird-buckets', houseId, date],
    queryFn: () => {
      const from = Date.parse(`${date}T00:00:00+07:00`)
      return analyticsApi
        .getBirdCountBuckets(houseId, new Date(from).toISOString(), new Date(from + DAY_MS).toISOString())
        .then(response => response.data.data.buckets)
    },
    enabled: Boolean(houseId && date),
  })
}
