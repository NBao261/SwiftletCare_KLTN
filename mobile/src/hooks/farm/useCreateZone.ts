import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { CreateZonePayload } from '@/types'

export interface CreateZoneInput {
  houseId: string
  payload: CreateZonePayload
}

// Thêm zone (tầng) vào nhà (FARM-FR-002): backend chép ngưỡng mặc định vào; xong thì tải lại zone của nhà
export function useCreateZone() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ houseId, payload }: CreateZoneInput) =>
      farmApi.createZone(houseId, payload).then(response => response.data.data),
    onSuccess: (_zone, { houseId }) => queryClient.invalidateQueries({ queryKey: ['zones', houseId] }),
  })
}
