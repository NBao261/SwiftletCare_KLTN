import { useMutation, useQueryClient } from '@tanstack/react-query'
import { harvestApi } from '@/services/api/harvest.api'

// Chủ trại xác nhận một lần thu (HARVEST-FR-006): xác nhận song song mọi đợt DRAFT của lần thu; một đợt lỗi thì báo lỗi, đợt đã
// xác nhận vẫn hiện đúng sau khi tải lại. Xác nhận đóng chu kỳ thu của zone (BR-43) nên tải lại cả chu kỳ
export function useConfirmHarvestRun(farmId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (harvestIds: string[]) => {
      const settled = await Promise.allSettled(harvestIds.map(harvestId => harvestApi.confirm(harvestId)))
      const failure = settled.find(result => result.status === 'rejected')
      if (failure) throw failure.reason
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['harvests', farmId] }),
        queryClient.invalidateQueries({ queryKey: ['harvest-cycles'] }),
      ]),
  })
}
