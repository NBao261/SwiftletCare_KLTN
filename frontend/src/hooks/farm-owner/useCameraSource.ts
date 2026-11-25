import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cameraApi } from '@/apis/farm-owner/camera.api';
import type { CameraSourceInput } from '@/types';

// Nút AI báo tình trạng camera mỗi lần heartbeat: đọc lại khi đang mở cửa sổ (hằng giao diện)
const STATUS_POLL_MS = 30_000;

export function useCameraSource(cameraId: string | undefined) {
  return useQuery({
    queryKey: ['camera-source', cameraId],
    queryFn: () => cameraApi.getSource(cameraId!).then(response => response.data.data),
    enabled: !!cameraId,
    refetchInterval: STATUS_POLL_MS,
  });
}

export function useUpdateCameraSource(cameraId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CameraSourceInput) => cameraApi.updateSource(cameraId, input).then(response => response.data.data),
    onSuccess: data => {
      queryClient.setQueryData(['camera-source', cameraId], data);
      void queryClient.invalidateQueries({ queryKey: ['camera-nodes'] });
    },
  });
}
