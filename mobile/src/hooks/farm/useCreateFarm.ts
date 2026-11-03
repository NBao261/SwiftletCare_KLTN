import { useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import type { CreateFarmPayload } from '@/types'

// Tạo trang trại mới (FARM-FR-001): người tạo là chủ chính; xong thì tải lại danh sách farm
export function useCreateFarm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateFarmPayload) => farmApi.create(payload).then(response => response.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['farms'] }),
  })
}
