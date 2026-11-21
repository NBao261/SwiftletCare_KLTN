import { useQuery } from '@tanstack/react-query'
import { harvestApi } from '@/services/api/harvest.api'

// Vài lần thu mỗi năm (BR-43) nên một nhà ít chu kỳ; tải một trang đủ dùng
const CYCLE_LIMIT = 30

// Chu kỳ thu của một nhà, chu kỳ bắt đầu sau đứng trước (HARVEST-FR-007)
export function useHarvestCycles(houseId: string) {
  return useQuery({
    queryKey: ['harvest-cycles', houseId],
    queryFn: () =>
      harvestApi
        .listCycles(houseId, CYCLE_LIMIT)
        .then(response => [...response.data.data].sort((left, right) => right.start_date.localeCompare(left.start_date))),
    enabled: Boolean(houseId),
  })
}
