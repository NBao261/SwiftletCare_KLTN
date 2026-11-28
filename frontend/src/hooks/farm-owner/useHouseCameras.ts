import { useQuery } from '@tanstack/react-query';

import { cameraApi } from '@/apis/farm-owner/camera.api';
import type { DeviceStatus } from '@/types';

// Trạng thái phát được video; DEGRADED đã bỏ theo
const READY_STATUSES = new Set<DeviceStatus>(['ONLINE']);
// Chu kỳ hỏi lại khi camera chưa sẵn sàng (hằng giao diện, không có nguồn)
const NOT_READY_POLL_MS = 30_000;

// Camera đang lắp của 1 nhà yến (bỏ camera đã gỡ); dùng chung cache với danh sách nhiều nhà
export const houseCamerasQuery = (houseId: string) => ({
  queryKey: ['camera-nodes', 'house', houseId],
  queryFn: () => cameraApi.listHouseCameras(houseId).then(response => response.data.data.filter(camera => !camera.decommissioned_at)),
});

export function useHouseCameras(houseId: string | undefined) {
  return useQuery({
    ...houseCamerasQuery(houseId ?? ''),
    enabled: !!houseId,
    // Camera PENDING / OFFLINE / ERROR thì tải lại để thẻ tự chuyển sang phát khi camera lên
    refetchInterval: query => (query.state.data?.some(camera => !READY_STATUSES.has(camera.status)) ? NOT_READY_POLL_MS : false),
  });
}
