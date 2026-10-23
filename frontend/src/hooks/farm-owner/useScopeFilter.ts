import { useMemo } from 'react';

import { sortPinnedFirst } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import { useScopeZones } from '@/hooks/farm-owner/useFarmOwnerDashboard';
import { usePinnedHouses } from '@/hooks/farm-owner/usePinnedHouses';
import { useFarms, useHouses, type AllZone } from '@/hooks/shared/useFarms';
import { useZoneStore } from '@/stores/zoneStore';
import type { House } from '@/types';

export interface ScopeFilterState {
  farmId: string;
  farmName: string;
  houses: House[];
  // Nhà đang lọc; '' = tất cả nhà yến (cả khi nhà đã lưu không còn thuộc farm)
  houseId: string;
  houseName: string;
  // Zone trong phạm vi: của nhà đang lọc, hoặc mọi Zone của farm khi chọn tất cả nhà
  zones: AllZone[];
  // Zone đang lọc; undefined = tất cả Zone (tổng các Zone trong phạm vi)
  zone: AllZone | undefined;
  setHouseId: (houseId: string) => void;
  setZoneId: (zoneId: string) => void;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

// Khung lọc Nhà + Zone dùng chung các trang Farm Owner, lựa chọn lưu trong store nên chuyển trang không bị trả về
export function useScopeFilter(): ScopeFilterState {
  const selectedFarmId = useZoneStore(state => state.selectedFarmId);
  const selectedHouseId = useZoneStore(state => state.selectedHouseId);
  const scopeZoneId = useZoneStore(state => state.scopeZoneId);
  const setHouseId = useZoneStore(state => state.setHouse);
  const setScopeZone = useZoneStore(state => state.setScopeZone);
  const setZone = useZoneStore(state => state.setZone);
  const { data: farms, isLoading: isLoadingFarms, isError: isFarmsError, refetch: refetchFarms } = useFarms();
  const farm = farms?.find(item => item._id === selectedFarmId) ?? farms?.[0];
  const farmId = farm?._id ?? '';
  const farmName = farm?.name ?? '';
  const { data: houseList, isLoading: isLoadingHouses, isError: isHousesError, refetch: refetchHouses } = useHouses(farm?._id);
  const { pinned } = usePinnedHouses();

  // Nhà đã ghim lên đầu danh sách
  const houses = useMemo(() => sortPinnedFirst(houseList ?? [], pinned), [houseList, pinned]);
  const selectedHouse = houses.find(house => house._id === selectedHouseId);
  const houseId = selectedHouse?._id ?? '';
  const { zones, isLoading: isLoadingZones } = useScopeZones(farmId, houseId);
  // Chỉ lọc được Zone khi đã chọn 1 nhà; Zone đã lưu không còn thuộc nhà thì về tất cả Zone
  const zone = houseId ? zones.find(item => item._id === scopeZoneId) : undefined;

  // Chọn 1 Zone thì ghi luôn Zone đang xem chung để trang Thiết bị mở đúng Zone đó
  function setZoneId(zoneId: string): void {
    setScopeZone(zoneId);
    const nextZone = zones.find(item => item._id === zoneId);
    if (nextZone && farmId) setZone(farmId, farmName, nextZone._id, nextZone.name);
  }

  return {
    farmId,
    farmName,
    houses,
    houseId,
    houseName: selectedHouse?.name ?? '',
    zones,
    zone,
    setHouseId,
    setZoneId,
    isLoading: isLoadingFarms || isLoadingHouses || isLoadingZones,
    isError: isFarmsError || isHousesError,
    refetch: () => {
      void refetchFarms();
      void refetchHouses();
    },
  };
}
