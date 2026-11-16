import { useMutation, useQueryClient } from '@tanstack/react-query'
import { harvestApi } from '@/services/api/harvest.api'
import type { HarvestBatch } from '@/types'
import type { HarvestOperation } from '@/utils/harvest.utils'

// Kết quả từng thao tác: đợt còn lại sau thao tác (xoá thì null), hoặc lỗi để báo và thử lại riêng loại đó
export type HarvestOperationResult =
  | { operation: HarvestOperation; isSaved: true; batch: HarvestBatch | null }
  | { operation: HarvestOperation; isSaved: false; error: unknown }

// Gửi một thao tác của một loại yến
function runOperation(operation: HarvestOperation): Promise<HarvestBatch | null> {
  if (operation.kind === 'create') return harvestApi.create(operation.payload).then(response => response.data.data)
  if (operation.kind === 'update') {
    return harvestApi.update(operation.harvestId, operation.payload).then(response => response.data.data)
  }
  return harvestApi.remove(operation.harvestId).then(() => null)
}

// Ghi hoặc sửa một lần thu (HARVEST-FR-001, 005): backend lưu mỗi loại yến một đợt nên gửi song song từng loại, không dừng khi một
// loại lỗi — màn giữ lại loại đã lưu để lần bấm sau chỉ gửi loại lỗi (như form web). Xong thì tải lại đợt thu của farm
export function useSaveHarvestRun(farmId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (operations: HarvestOperation[]): Promise<HarvestOperationResult[]> => {
      const settled = await Promise.allSettled(operations.map(runOperation))
      return settled.map((result, index) =>
        result.status === 'fulfilled'
          ? { operation: operations[index], isSaved: true, batch: result.value }
          : { operation: operations[index], isSaved: false, error: result.reason },
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['harvests', farmId] }),
  })
}
