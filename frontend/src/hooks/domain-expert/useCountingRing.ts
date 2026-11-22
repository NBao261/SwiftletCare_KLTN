import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deviceApi } from '@/apis/shared/devices.api'
import { countingRingApi } from '@/apis/domain-expert/countingRing.api'
import type { CountingRing } from '@/types'

// Camera đang lắp của 1 nhà (bỏ camera đã gỡ): dùng API thiết bị dùng chung đa vai trò
export const HOUSE_CAMERAS_KEY = (houseId: string | undefined) =>
  ['camera-nodes', 'house', houseId] as const

export function useHouseCameras(houseId: string | undefined) {
  return useQuery({
    queryKey: HOUSE_CAMERAS_KEY(houseId),
    queryFn: () =>
      deviceApi
        .listCameraNodes(houseId!)
        .then(response => response.data.data.filter(camera => !camera.decommissioned_at)),
    enabled: !!houseId,
  })
}

export function useUpdateCountingRing(houseId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cameraId, ring }: { cameraId: string; ring: CountingRing }) =>
      countingRingApi.update(cameraId, ring).then(response => response.data.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HOUSE_CAMERAS_KEY(houseId) })
    },
  })
}
