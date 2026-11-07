import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceApi, type RegisterCameraNodePayload } from '@/services/api/device.api'

// Đăng ký camera AI vào một nhà bằng mã trên nhãn (FARM-FR-004). gcTime 0: bỏ biến của mutation
// (có mã kích hoạt) khỏi bộ nhớ ngay khi màn đóng, không giữ mã trong cache
export function useRegisterCameraNode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: RegisterCameraNodePayload) =>
      deviceApi.registerCameraNode(payload).then(response => response.data.data),
    gcTime: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices', 'camera-nodes'] }),
  })
}
