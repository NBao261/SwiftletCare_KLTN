import { useQuery } from '@tanstack/react-query';

import { cameraApi } from '@/apis/farm-owner/camera.api';

// Camera đang lắp của 1 nhà yến (bỏ camera đã gỡ)
export function useHouseCameras(houseId: string | undefined) {
  return useQuery({
    queryKey: ['camera-nodes', 'house', houseId],
    queryFn: () => cameraApi.listHouseCameras(houseId!).then(response => response.data.data.filter(camera => !camera.decommissioned_at)),
    enabled: !!houseId,
  });
}
