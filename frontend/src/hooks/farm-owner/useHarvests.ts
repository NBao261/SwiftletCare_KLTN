import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { harvestApi } from '@/apis/farm-owner/harvests.api'
import type { CreateHarvestInput } from '@/apis/farm-owner/harvests.api'

// MARKET-FR-001..005 — farmId undefined = đợt thu của mọi farm tài khoản xem được
export function useHarvests(farmId: string | undefined) {
  return useQuery({
    queryKey: ['harvests', farmId],
    queryFn: () => harvestApi.list(farmId).then(response => response.data.data),
  })
}

// Thêm / sửa / xoá đợt thu làm mới mọi danh sách đợt thu (trang Thu hoạch, sản lượng tháng ở Tổng quan, Trang trại)
export function useCreateHarvest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateHarvestInput) => harvestApi.create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['harvests'] }),
  })
}

export function useUpdateHarvest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<Omit<CreateHarvestInput, 'zone_id'>>) =>
      harvestApi.update(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['harvests'] }),
  })
}

export function useDeleteHarvest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => harvestApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['harvests'] }),
  })
}
