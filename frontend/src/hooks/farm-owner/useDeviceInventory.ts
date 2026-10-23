import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { deviceApi } from '@/apis/shared/devices.api';
import { buildDeviceInventory } from '@/components/features/farm-owner/devices/deviceInventory';
import { useSensorNodes } from '@/hooks/shared/useDevices';
import type { House, Zone } from '@/types';

// Thiết bị của các nhà yến theo Nhà → Zone; node cảm biến và camera mỗi loại 1 request theo quyền truy cập (dùng chung cache với màn Trang trại)
export function useDeviceInventory(houses: House[], zones: Zone[], zoneId?: string) {
  const sensorsQuery = useSensorNodes();
  const camerasQuery = useQuery({
    queryKey: ['camera-nodes'],
    queryFn: () => deviceApi.listCameraNodes().then(response => response.data.data),
  });
  const sensors = sensorsQuery.data;
  const cameras = camerasQuery.data;

  const inventory = useMemo(
    () => buildDeviceInventory({ houses, zones, sensors: sensors ?? [], cameras: cameras ?? [], zoneId }),
    [houses, zones, sensors, cameras, zoneId],
  );

  return {
    inventory,
    isLoading: sensorsQuery.isLoading || camerasQuery.isLoading,
    isError: sensorsQuery.isError || camerasQuery.isError,
    refetch: () => {
      void sensorsQuery.refetch();
      void camerasQuery.refetch();
    },
  };
}
