import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deviceApi, type RegisterSensorNodePayload } from '@/services/api/device.api'

// Đăng ký controller vào một zone bằng mã trên nhãn (FARM-FR-003, MF-10). gcTime 0: bỏ biến của mutation
// (có mã kích hoạt) khỏi bộ nhớ ngay khi màn đóng, không giữ mã trong cache
export function useRegisterSensorNode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: RegisterSensorNodePayload) =>
      deviceApi.registerSensorNode(payload).then(response => response.data.data),
    gcTime: 0,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices', 'sensor-nodes'] }),
  })
}
