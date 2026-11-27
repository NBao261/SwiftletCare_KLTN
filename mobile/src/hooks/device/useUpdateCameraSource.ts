import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceApi } from '@/services/api/device.api'
import type { UpdateCameraSourcePayload } from '@/types'

export interface UpdateCameraSourceInput {
  cameraId: string
  payload: UpdateCameraSourcePayload
}

// Lưu địa chỉ camera IP của camera đếm chim (FARM-FR-004b); xong thì ghi bản backend trả vào cache và tải lại danh sách camera
// để thấy tình trạng mới
export function useUpdateCameraSource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ cameraId, payload }: UpdateCameraSourceInput) =>
      deviceApi.updateCameraSource(cameraId, payload).then(response => response.data.data),
    onSuccess: (view, { cameraId }) => {
      queryClient.setQueryData(['devices', 'camera-source', cameraId], view)
      return queryClient.invalidateQueries({ queryKey: ['devices', 'camera-nodes'] })
    },
  })
}
