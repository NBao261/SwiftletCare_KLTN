import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';

import { farmApi } from '@/apis/shared/farms.api';
import { sortPinnedFirst } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import { usePinnedHouses } from '@/hooks/farm-owner/usePinnedHouses';
import { useScopeIssues } from '@/hooks/farm-owner/useFarmOwnerDashboard';
import { useAllZones, useFarms, type AllZone } from '@/hooks/shared/useFarms';
import { UP_FROM_CHILD_STATE } from '@/lib/navigationState';
import { useZoneStore } from '@/stores/zoneStore';
import type { Farm, House } from '@/types';

// Cùng staleTime với useHouses / useFarmStructure để dùng chung cache ['houses', farmId]
const HOUSES_STALE_MS = 5 * 60 * 1000;
const NO_ZONES: AllZone[] = [];

export interface ScopeFilterState {
  // Mọi trang trại của tài khoản, tạo trước đứng trước
  farms: Farm[];
  // Trang trại đang lọc; '' = tất cả trang trại
  farmId: string;
  farmName: string;
  // Tên trang trại theo mã, để ghi kèm tên farm khi đang xem tất cả trang trại
  farmNames: Map<string, string>;
  // Nhà trong phạm vi: của farm đang lọc, hoặc của mọi farm
  houses: House[];
  // Nhà đang lọc; '' = tất cả nhà trong phạm vi (chỉ chọn được nhà khi đã chọn 1 farm)
  houseId: string;
  houseName: string;
  // Zone trong phạm vi: của nhà đang lọc, hoặc mọi Zone của farm / mọi farm
  zones: AllZone[];
  // Zone đang lọc; undefined = tất cả Zone (chỉ chọn được Zone khi đã chọn 1 nhà)
  zone: AllZone | undefined;
  // Farm / nhà / Zone đang có Zone vượt ngưỡng, thiết bị hoặc camera hư — chấm cam ở khung lọc
  issueFarmIds: Set<string>;
  issueHouseIds: Set<string>;
  issueZoneIds: Set<string>;
  setFarmId: (farmId: string) => void;
  setHouseId: (houseId: string) => void;
  setZoneId: (zoneId: string) => void;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

// Khung lọc Trang trại → Nhà → Zone dùng chung các trang Farm Owner, lựa chọn lưu trong store nên chuyển trang không bị trả về
export function useScopeFilter(): ScopeFilterState {
  const scopeFarmId = useZoneStore(state => state.scopeFarmId);
  const selectedHouseId = useZoneStore(state => state.selectedHouseId);
  const scopeZoneId = useZoneStore(state => state.scopeZoneId);
  const setScopeFarm = useZoneStore(state => state.setScopeFarm);
  const setHouse = useZoneStore(state => state.setHouse);
  const setScopeZone = useZoneStore(state => state.setScopeZone);
  const setZone = useZoneStore(state => state.setZone);
  const { data: farmData, isLoading: isLoadingFarms, isError: isFarmsError, refetch: refetchFarms } = useFarms();
  const { data: allZones, isLoading: isLoadingZones, isError: isZonesError, refetch: refetchZones } = useAllZones();
  const { pinned } = usePinnedHouses();

  // Trang trại tạo trước đứng trước (mã Mongo tăng theo thời gian tạo)
  const farms = useMemo(() => [...(farmData ?? [])].sort((left, right) => left._id.localeCompare(right._id)), [farmData]);
  const farmNames = useMemo(() => new Map(farms.map(farm => [farm._id, farm.name])), [farms]);
  // Farm đã lưu không còn trong danh sách (đã xoá, mất quyền) thì về tất cả trang trại
  const farm = farms.find(item => item._id === scopeFarmId);
  const farmId = farm?._id ?? '';

  // Nhà của mọi farm, mỗi farm 1 request (chung cache với useHouses)
  const housesQuery = useQueries({
    queries: farms.map(item => ({
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

  // Nhà trong phạm vi farm, nhà đã ghim lên đầu trong từng farm
  const houses = useMemo(() => {
    const scoped: House[] = [];
    farms.forEach((item, index) => {
      if (!farmId || item._id === farmId) scoped.push(...sortPinnedFirst(housesQuery.lists[index] ?? [], pinned));
    });
    return scoped;
  }, [farms, farmId, housesQuery.lists, pinned]);
  const selectedHouse = farmId ? houses.find(house => house._id === selectedHouseId) : undefined;
  const houseId = selectedHouse?._id ?? '';

  const zones = useMemo(
    () => (allZones ?? []).filter(item => (!farmId || item.farmId === farmId) && (!houseId || item.house_id === houseId)),
    [allZones, farmId, houseId],
  );
  // Zone đã lưu không còn thuộc nhà đang lọc thì về tất cả Zone
  const zone = houseId ? zones.find(item => item._id === scopeZoneId) : undefined;
  const everyHouse = useMemo(() => housesQuery.lists.flat(), [housesQuery.lists]);
  const { issueFarmIds, issueHouseIds, issueZoneIds } = useScopeIssues(allZones ?? NO_ZONES, everyHouse);

  // Đổi farm thì bỏ lọc nhà và Zone của farm cũ
  function setFarmId(nextFarmId: string): void {
    setScopeFarm(nextFarmId, farmNames.get(nextFarmId) ?? '');
  }

  // Chọn 1 Zone thì ghi luôn Zone đang xem chung để trang Thiết bị mở đúng Zone đó
  function setZoneId(zoneId: string): void {
    setScopeZone(zoneId);
    const nextZone = zones.find(item => item._id === zoneId);
    if (nextZone && farmId) setZone(farmId, farm?.name ?? '', nextZone._id, nextZone.name);
  }

  return {
    farms,
    farmId,
    farmName: farm?.name ?? '',
    farmNames,
    houses,
    houseId,
    houseName: selectedHouse?.name ?? '',
    zones,
    zone,
    issueFarmIds,
    issueHouseIds,
    issueZoneIds,
    setFarmId,
    setHouseId: setHouse,
    setZoneId,
    isLoading: isLoadingFarms || housesQuery.isLoading || isLoadingZones,
    isError: isFarmsError || housesQuery.isError || isZonesError,
    refetch: () => {
      void refetchFarms();
      void refetchZones();
      housesQuery.refetch();
    },
  };
}

// Trang Trang trại (danh sách farm)
export const FARMS_PATH = '/farms';

export function farmHousePath(farmId: string, houseId: string): string {
  return `/farms/${farmId}/houses/${houseId}`;
}

export function farmZonePath(farmId: string, houseId: string, zoneId: string): string {
  return `/farms/${farmId}/houses/${houseId}/zones/${zoneId}`;
}

// Khung lọc ở các trang Trang trại: đổi lựa chọn thì sang trang đúng cấp (farm → danh sách, nhà → chi tiết nhà, Zone → chi tiết Zone)
export function useFarmsScopeRouting(scope: ScopeFilterState): ScopeFilterState {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function setFarmId(farmId: string): void {
    scope.setFarmId(farmId);
    if (pathname !== FARMS_PATH) navigate(FARMS_PATH, { state: UP_FROM_CHILD_STATE });
  }

  function setHouseId(houseId: string): void {
    scope.setHouseId(houseId);
    const house = scope.houses.find(item => item._id === houseId);
    if (house) navigate(farmHousePath(house.farm_id, house._id));
    else navigate(FARMS_PATH, { state: UP_FROM_CHILD_STATE });
  }

  function setZoneId(zoneId: string): void {
    scope.setZoneId(zoneId);
    const zone = scope.zones.find(item => item._id === zoneId);
    if (zone) navigate(farmZonePath(zone.farmId, zone.house_id, zone._id));
    else if (scope.farmId && scope.houseId) navigate(farmHousePath(scope.farmId, scope.houseId));
  }

  return { ...scope, setFarmId, setHouseId, setZoneId };
}
