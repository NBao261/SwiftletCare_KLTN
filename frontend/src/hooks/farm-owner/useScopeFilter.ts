import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import { farmApi } from '@/apis/shared/farms.api';
import { sortPinnedFirst } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import { useScopeZones } from '@/hooks/farm-owner/useFarmOwnerDashboard';
import { usePinnedHouses } from '@/hooks/farm-owner/usePinnedHouses';
import { useFarms, type AllZone } from '@/hooks/shared/useFarms';
import { useZoneStore } from '@/stores/zoneStore';
import type { Farm, House } from '@/types';

// Cùng staleTime với useHouses / useFarmStructure để dùng chung cache ['houses', farmId]
const HOUSES_STALE_MS = 5 * 60 * 1000;

// Giá trị ô Nhà cho "tất cả nhà của 1 farm" khi tài khoản có nhiều farm
const FARM_OPTION_PREFIX = 'farm:';

export interface ScopeHouseOption {
  value: string;
  // Tên nhà; '' = dòng "tất cả nhà" của farm
  houseName: string;
  farmName: string;
}

export interface ScopeFilterState {
  farmId: string;
  farmName: string;
  // Nhà của farm đang xem (các trang tính theo farm này)
  houses: House[];
  // Nhà đang lọc; '' = tất cả nhà yến của farm đang xem
  houseId: string;
  houseName: string;
  // Tài khoản có từ 2 farm: ô Nhà ghi kèm tên farm và có dòng "tất cả" cho từng farm
  isMultiFarm: boolean;
  // Mọi lựa chọn của ô Nhà (nhà của mọi farm) và lựa chọn đang chọn
  houseOptions: ScopeHouseOption[];
  houseValue: string;
  // Zone trong phạm vi: của nhà đang lọc, hoặc mọi Zone của farm khi chọn tất cả nhà
  zones: AllZone[];
  // Zone đang lọc; undefined = tất cả Zone (tổng các Zone trong phạm vi)
  zone: AllZone | undefined;
  // Chọn 1 nhà (của farm bất kỳ) hoặc "tất cả nhà" của 1 farm
  setHouseId: (value: string) => void;
  setZoneId: (zoneId: string) => void;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

// Khung lọc Nhà + Zone dùng chung các trang Farm Owner, lựa chọn lưu trong store nên chuyển trang không bị trả về;
// liệt kê nhà của mọi farm, chọn nhà ở farm khác thì trang chuyển sang farm đó
export function useScopeFilter(): ScopeFilterState {
  const selectedFarmId = useZoneStore(state => state.selectedFarmId);
  const selectedHouseId = useZoneStore(state => state.selectedHouseId);
  const scopeZoneId = useZoneStore(state => state.scopeZoneId);
  const setHouse = useZoneStore(state => state.setHouse);
  const setFarm = useZoneStore(state => state.setFarm);
  const setScopeZone = useZoneStore(state => state.setScopeZone);
  const setZone = useZoneStore(state => state.setZone);
  const { data: farms, isLoading: isLoadingFarms, isError: isFarmsError, refetch: refetchFarms } = useFarms();
  const farm = farms?.find(item => item._id === selectedFarmId) ?? farms?.[0];
  const farmId = farm?._id ?? '';
  const farmName = farm?.name ?? '';
  const { pinned } = usePinnedHouses();

  // Nhà của mọi farm, mỗi farm 1 request (chung cache với useHouses)
  const farmList = useMemo(() => farms ?? [], [farms]);
  const housesQuery = useQueries({
    queries: farmList.map(item => ({
      queryKey: ['houses', item._id],
      queryFn: () => farmApi.listHouses(item._id).then(response => response.data.data),
      staleTime: HOUSES_STALE_MS,
    })),
    combine: results => ({
      lists: results.map(result => result.data ?? []),
      isLoading: results.some(result => result.isLoading),
      isError: results.some(result => result.isError),
      refetch: () => results.forEach(result => void result.refetch()),
    }),
  });

  // Nhà theo farm, nhà đã ghim lên đầu trong từng farm
  const housesByFarm = useMemo(() => {
    const map = new Map<string, House[]>();
    farmList.forEach((item, index) => map.set(item._id, sortPinnedFirst(housesQuery.lists[index] ?? [], pinned)));
    return map;
  }, [farmList, housesQuery.lists, pinned]);
  const houses = useMemo(() => housesByFarm.get(farmId) ?? [], [housesByFarm, farmId]);
  const selectedHouse = houses.find(house => house._id === selectedHouseId);
  const houseId = selectedHouse?._id ?? '';
  const isMultiFarm = farmList.length > 1;

  // Ô Nhà: 1 farm thì như cũ; nhiều farm thì mỗi farm 1 dòng "tất cả" rồi tới các nhà của farm đó
  const houseOptions = useMemo(() => {
    const options: ScopeHouseOption[] = [];
    if (!isMultiFarm) {
      options.push({ value: '', houseName: '', farmName });
      for (const house of houses) options.push({ value: house._id, houseName: house.name, farmName });
      return options;
    }
    for (const item of farmList) {
      options.push({ value: `${FARM_OPTION_PREFIX}${item._id}`, houseName: '', farmName: item.name });
      for (const house of housesByFarm.get(item._id) ?? []) options.push({ value: house._id, houseName: house.name, farmName: item.name });
    }
    return options;
  }, [isMultiFarm, farmList, housesByFarm, houses, farmName]);
  const houseValue = houseId || (isMultiFarm && farmId ? `${FARM_OPTION_PREFIX}${farmId}` : '');

  const { zones, isLoading: isLoadingZones } = useScopeZones(farmId, houseId);
  // Chỉ lọc được Zone khi đã chọn 1 nhà; Zone đã lưu không còn thuộc nhà thì về tất cả Zone
  const zone = houseId ? zones.find(item => item._id === scopeZoneId) : undefined;

  // Farm chứa 1 nhà (tra trong mọi farm)
  function farmOfHouse(targetHouseId: string): Farm | undefined {
    return farmList.find(item => (housesByFarm.get(item._id) ?? []).some(house => house._id === targetHouseId));
  }

  function setHouseId(value: string): void {
    // "Tất cả nhà" của 1 farm: chuyển farm, bỏ lọc nhà và Zone
    if (value.startsWith(FARM_OPTION_PREFIX)) {
      const target = farmList.find(item => item._id === value.slice(FARM_OPTION_PREFIX.length));
      if (target) setFarm(target._id, target.name);
      return;
    }
    // Nhà ở farm khác: chuyển farm trước rồi chọn nhà
    const owner = value ? farmOfHouse(value) : undefined;
    if (owner && owner._id !== farmId) setFarm(owner._id, owner.name);
    setHouse(value);
  }

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
    isMultiFarm,
    houseOptions,
    houseValue,
    zones,
    zone,
    setHouseId,
    setZoneId,
    isLoading: isLoadingFarms || housesQuery.isLoading || isLoadingZones,
    isError: isFarmsError || housesQuery.isError,
    refetch: () => {
      void refetchFarms();
      housesQuery.refetch();
    },
  };
}
