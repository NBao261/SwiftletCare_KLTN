import { keepPreviousData, useQueries, useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
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

// HARVEST-FR-001 — link ảnh của lô (có ở GET /harvests/{id}); khoá dưới ['harvests'] nên lưu lần thu là đọc lại
// Ảnh của lần thu = ảnh đầu tiên có trong các đợt của nó (một đợt thêm sau có thể chưa có ảnh)
export function useHarvestPhotoUrl(batchIds: string[]): string | null {
  return useQueries({
    queries: batchIds.map(batchId => ({
      queryKey: ['harvests', 'detail', batchId],
      queryFn: () => harvestApi.get(batchId).then(response => response.data.data.photo_url ?? null),
    })),
  }).find(query => query.data)?.data ?? null
}

// HARVEST-FR-001 — gửi 1 ảnh cho 1 lô
export function useUploadHarvestPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, photo }: { id: string; photo: File }) => harvestApi.uploadPhoto(id, photo),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['harvests'] }),
  })
}
