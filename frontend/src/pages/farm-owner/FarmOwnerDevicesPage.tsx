import { useMemo } from 'react';

import ScopeFilter from '@/components/common/ScopeFilter';
import HeaderActions from '@/components/layouts/HeaderActions';
import HouseDeviceAccordion from '@/components/features/farm-owner/devices/HouseDeviceAccordion';
import { Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import { devicesDict } from '@/constants/devices.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useDeviceInventory } from '@/hooks/farm-owner/useDeviceInventory';
import { useScopeFilter } from '@/hooks/farm-owner/useScopeFilter';

// Trang Thiết bị & Cảm biến của Farm Owner — chỉ xem (FARM-FR-005): bảng cha - con Nhà yến → Zone → thiết bị theo khung lọc Nhà + Zone chung
export default function FarmOwnerDevicesPage(): JSX.Element {
  const { t } = useTranslation(devicesDict);
  const scope = useScopeFilter();
  const { farmNames, houses, houseId, zones, zone, isLoading: isLoadingScope } = scope;
  // Phạm vi: 1 nhà đang lọc hoặc mọi nhà của farm; chọn 1 Zone thì chỉ còn thiết bị của Zone đó
  const scopedHouses = useMemo(() => (houseId ? houses.filter(house => house._id === houseId) : houses), [houses, houseId]);
  const { inventory, isLoading, isError, refetch } = useDeviceInventory(scopedHouses, zones, zone?._id);

  let body = <HouseDeviceAccordion inventory={inventory} farmNames={farmNames} />;
  if (isLoadingScope || isLoading) body = <LoadingSkeleton count={4} className="h-16 w-full" />;
  if (isError) {
    body = (
      <EmptyState
        title={t('list.errorTitle')}
        description={t('list.errorDesc')}
        action={<Button variant="secondary" size="sm" onClick={refetch}>{t('list.retry')}</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Khung lọc nằm trên header từ sm trở lên; mobile header chật nên đặt đầu trang */}
      <HeaderActions>
        <div className="hidden sm:block">
          <ScopeFilter scope={scope} />
        </div>
      </HeaderActions>
      <div className="sm:hidden">
        <ScopeFilter scope={scope} />
      </div>

      {body}
    </div>
  );
}
