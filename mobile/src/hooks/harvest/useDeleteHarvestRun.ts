import { useMutation, useQueryClient } from '@tanstack/react-query'
import { harvestApi } from '@/services/api/harvest.api'

// Xoá mềm một lần thu (HARVEST-FR-005): xoá mọi đợt của lần thu; một đợt lỗi thì báo lỗi, đợt đã xoá vẫn mất khỏi danh sách sau khi
// tải lại. Lô đã xác nhận bị xoá thì backend gộp chu kỳ của nó vào chu kỳ sau
export function useDeleteHarvestRun(farmId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (harvestIds: string[]) => {
      const settled = await Promise.allSettled(harvestIds.map(harvestId => harvestApi.remove(harvestId)))
      const failure = settled.find(result => result.status === 'rejected')
      if (failure) throw failure.reason
    },
    // Lần thu đã xác nhận đóng chu kỳ của zone, xoá thì backend gộp chu kỳ (BR-43), nên tải lại cả chu kỳ thu
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['harvests', farmId] }),
        queryClient.invalidateQueries({ queryKey: ['harvest-cycles'] }),
      ]),
  })
}
