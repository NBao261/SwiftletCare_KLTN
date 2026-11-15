import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  harvestCyclesApi,
  type HarvestCyclesParams,
  type CycleConclusionInput,
} from '@/apis/domain-expert/harvestCycles.api'

export const HARVEST_CYCLES_QUERY_KEY = (params: Partial<HarvestCyclesParams>) => [
  'harvest', 'cycles',
  params.farmId, params.houseId, params.zoneId, params.status, params.page,
]

export function useHarvestCycles(params: HarvestCyclesParams, enabled = true) {
  return useQuery({
    queryKey: HARVEST_CYCLES_QUERY_KEY(params),
    queryFn: () => harvestCyclesApi.list(params),
    enabled: enabled && (!!params.farmId || !!params.houseId || !!params.zoneId),
    staleTime: 60_000,
    select: res => ({
      cycles: Array.isArray(res.data.data) ? res.data.data : [],
      meta: res.data.meta,
    }),
  })
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
