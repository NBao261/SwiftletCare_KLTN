import { useQueries } from '@tanstack/react-query'
import { harvestApi } from '@/services/api/harvest.api'

// Ảnh của một lần thu (HARVEST-FR-001): danh sách đợt không có link ảnh, nên đọc chi tiết từng đợt và lấy ảnh của đợt đầu tiên
// có ảnh — như web (ảnh gửi cho mọi đợt của lần thu)
export function useHarvestRunPhoto(harvestIds: string[]) {
  return useQueries({
    queries: harvestIds.map(harvestId => ({
      queryKey: ['harvests', 'detail', harvestId],
      queryFn: () => harvestApi.get(harvestId).then(response => response.data.data.photo_url ?? null),
    })),
    combine: results => ({
      photoUrl: results.find(result => result.data)?.data ?? null,
      isLoading: results.some(result => result.isLoading),
      isError: results.some(result => result.isError),
      // Link ảnh là link ký sẵn có hạn: thử lại thì xin link mới
      refetch: () => Promise.all(results.map(result => result.refetch())),
    }),
  })
}
