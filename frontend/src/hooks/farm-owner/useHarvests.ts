import { keepPreviousData, useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'
import { harvestApi } from '@/apis/farm-owner/harvests.api'
import { harvestCyclesApi } from '@/apis/domain-expert/harvestCycles.api'
import type { CreateHarvestInput } from '@/apis/farm-owner/harvests.api'

// HARVEST-FR-001..005 — farmId undefined = đợt thu của mọi farm tài khoản xem được
export function useHarvests(farmId: string | undefined) {
  return useQuery({
    queryKey: ['harvests', farmId],
    queryFn: () => harvestApi.list(farmId).then(response => response.data.data),
  })
}

// HARVEST-FR-007 — 1 trang chu kỳ (nhà, farm hoặc mọi farm), khoá ['harvest', 'cycles'] chung với màn kết luận mùa vụ
export function useHarvestCycleList(farmId: string, houseId: string, page: number, limit: number) {
  return usePaginatedListQuery(
    ['harvest', 'cycles', 'list', farmId, houseId, page, limit],
    () => harvestCyclesApi.list({ farmId: farmId || undefined, houseId: houseId || undefined, page, limit }),
    page,
    limit,
    // Giữ trang cũ trong lúc tải trang mới để bảng không nháy khung tải
    { placeholderData: keepPreviousData },
  )
}

// Lô đổi thì backend dựng lại chu kỳ của zone (HARVEST-FR-007) nên làm mới cả đợt thu (trang Thu hoạch, Tổng quan, Trang trại) lẫn chu kỳ
function invalidateHarvests(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['harvests'] })
  void queryClient.invalidateQueries({ queryKey: ['harvest', 'cycles'] })
}

export function useCreateHarvest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateHarvestInput) => harvestApi.create(input),
    onSuccess: () => invalidateHarvests(queryClient),
  })
}

export function useUpdateHarvest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<Omit<CreateHarvestInput, 'zone_id'>>) =>
      harvestApi.update(id, input),
    onSuccess: () => invalidateHarvests(queryClient),
  })
}

export function useConfirmHarvest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => harvestApi.confirm(id),
    onSuccess: () => invalidateHarvests(queryClient),
  })
}

export function useDeleteHarvest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => harvestApi.remove(id),
    onSuccess: () => invalidateHarvests(queryClient),
  })
}
