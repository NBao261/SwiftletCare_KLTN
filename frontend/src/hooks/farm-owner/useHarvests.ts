import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { harvestApi } from '@/apis/farm-owner/harvests.api'
import type { CreateHarvestInput } from '@/apis/farm-owner/harvests.api'

/** MARKET-FR-001..005 */
export function useHarvests(farmId: string | undefined) {
  return useQuery({
    queryKey: ['harvests', farmId],
    queryFn: () => harvestApi.list(farmId).then(r => r.data.data),
    enabled: !!farmId,
  })
}


export function useCreateHarvest(farmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateHarvestInput) => harvestApi.create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['harvests', farmId] }),
  })
}

export function useUpdateHarvest(farmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<Omit<CreateHarvestInput, 'zone_id'>>) =>
      harvestApi.update(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['harvests', farmId] }),
  })
}

export function useDeleteHarvest(farmId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => harvestApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['harvests', farmId] }),
  })
}
