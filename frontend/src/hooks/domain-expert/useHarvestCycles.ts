import { keepPreviousData, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  harvestCyclesApi,
  type HarvestCyclesParams,
  type CycleConclusionInput,
} from '@/apis/domain-expert/harvestCycles.api'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'

// HARVEST-FR-007, EXPERT-FR-020 — 1 trang chu kỳ theo farm/nhà/zone, khoá ['harvest', 'cycles'] chung với trang Thu hoạch
export function useHarvestCycles(params: HarvestCyclesParams, enabled = true) {
  return usePaginatedListQuery(
    ['harvest', 'cycles', params.farmId, params.houseId, params.zoneId, params.status, params.page, params.limit],
    () => harvestCyclesApi.list(params),
    params.page,
    params.limit,
    {
      enabled: enabled && (!!params.farmId || !!params.houseId || !!params.zoneId),
      // Giữ trang cũ trong lúc tải trang mới để bảng không nháy khung tải
      placeholderData: keepPreviousData,
    },
  )
}

export function useSubmitCycleConclusion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CycleConclusionInput }) =>
      harvestCyclesApi.conclude(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['harvest', 'cycles'] })
    },
  })
}
