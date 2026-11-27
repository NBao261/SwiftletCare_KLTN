import { useMutation, useQueryClient } from '@tanstack/react-query'
import { harvestApi } from '@/services/api/harvest.api'
import type { LocalPhoto } from '@/types'

export interface UploadHarvestPhotoInput {
  harvestIds: string[]
  photo: LocalPhoto
}

// Gửi một ảnh cho mọi đợt của lần thu (HARVEST-FR-001), song song, không dừng khi một đợt lỗi — như web. Trả số đợt chưa gửi
// được để màn báo; xong thì tải lại ảnh của các đợt đó
export function useUploadHarvestPhoto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ harvestIds, photo }: UploadHarvestPhotoInput): Promise<number> => {
      const settled = await Promise.allSettled(harvestIds.map(harvestId => harvestApi.uploadPhoto(harvestId, photo)))
      return settled.filter(result => result.status === 'rejected').length
    },
    onSettled: (_failedCount, _error, { harvestIds }) =>
      Promise.all(
        harvestIds.map(harvestId => queryClient.invalidateQueries({ queryKey: ['harvests', 'detail', harvestId] })),
      ),
  })
}
