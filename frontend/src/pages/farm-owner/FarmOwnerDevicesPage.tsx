import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ScopeFilter from '@/components/common/ScopeFilter';
import StatusTabs from '@/components/common/StatusTabs';
import HeaderActions from '@/components/layouts/HeaderActions';
import DeviceListTable from '@/components/features/farm-owner/devices/DeviceListTable';
import { listDeviceRows, type DeviceRow } from '@/components/features/farm-owner/devices/deviceInventory';
import { DEVICE_DETAIL_PATH, type DeviceDetailState } from '@/components/features/farm-owner/devices/devices.constants';
import RemovedDevicesSection from '@/components/features/farm-owner/devices/RemovedDevicesSection';
import { Button, EmptyState, LoadingSkeleton, SectionCard } from '@/components/ui';
import { devicesDict } from '@/constants/devices.i18n';
import { DEVICE_SETUP_ROLES } from '@/constants/roles';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useDeviceInventory } from '@/hooks/farm-owner/useDeviceInventory';
import { useScopeFilter } from '@/hooks/shared/useScopeFilter';
import type { DeviceStatus } from '@/types';

// Tab trạng thái: mất kết nối đứng ngay sau "Tất cả" vì là thứ chủ nhà cần thấy trước
const STATUS_TABS = ['all', 'OFFLINE', 'ONLINE', 'PENDING'] as const satisfies readonly (DeviceStatus | 'all')[];
type StatusTab = (typeof STATUS_TABS)[number];

// Thiết bị của Farm Owner, chỉ xem
export default function FarmOwnerDevicesPage(): JSX.Element {
  const { t } = useTranslation(devicesDict);
  const navigate = useNavigate();
  // Farm Owner thiết lập thiết bị; chuyên gia chỉ xem trang này
  const canSetUp = usePermission(...DEVICE_SETUP_ROLES);
  const scope = useScopeFilter();
  const { houses, houseId, zones, zone, isLoading: isLoadingScope } = scope;
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  // Phạm vi: 1 nhà đang lọc hoặc mọi nhà của farm; chọn 1 Zone thì chỉ còn thiết bị của Zone đó
  const scopedHouses = useMemo(() => (houseId ? houses.filter(house => house._id === houseId) : houses), [houses, houseId]);
  const { inventory, isLoading, isError, refetch } = useDeviceInventory(scopedHouses, zones, zone?._id);

  const allRows = useMemo(() => listDeviceRows(inventory), [inventory]);
  // Số thiết bị theo từng trạng thái, đếm 1 lần cho các tab
  const counts = useMemo(() => {
    const result: Record<StatusTab, number> = { all: allRows.length, OFFLINE: 0, ONLINE: 0, PENDING: 0 };
    for (const row of allRows) result[row.device.status] += 1;
    return result;
  }, [allRows]);
  const visibleRows = useMemo(
    () => (statusTab === 'all' ? allRows : allRows.filter(row => row.device.status === statusTab)),
    [allRows, statusTab],
  );

  // Id truyền qua history state, không đưa lên URL
  const openDetail = useCallback((row: DeviceRow) => {
    const state: DeviceDetailState = { houseId: row.house._id, deviceId: row.device.id };
    navigate(DEVICE_DETAIL_PATH, { state });
  }, [navigate]);

  let body = (
    <>
      <StatusTabs
        variant="underline"
        ariaLabel={t('list.filterStatus')}
        value={statusTab}
        onChange={setStatusTab}
        tabs={STATUS_TABS.map(id => ({ id, label: t(`tab.${id}`), badge: id === 'OFFLINE' ? counts.OFFLINE : undefined }))}
      />
      <DeviceListTable rows={visibleRows} hasAnyDevice={allRows.length > 0} onOpen={openDetail} />
    </>
  );
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
      {/* Khung lọc trên header, dưới xl xuống hàng riêng */}
      <HeaderActions>
        <ScopeFilter scope={scope} />
        {canSetUp && <Button size="sm" onClick={() => navigate('/devices/onboarding')}>{t('list.setup')}</Button>}
      </HeaderActions>

      <SectionCard description={t('list.short')} help={t('list.help')}>
        {body}
      </SectionCard>
      {/* thiết bị gỡ nhầm khôi phục được trong 24 giờ */}
      <RemovedDevicesSection />
    </div>
  );
}
