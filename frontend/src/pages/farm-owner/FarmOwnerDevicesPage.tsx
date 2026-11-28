import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlusIcon } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

import ScopeFilter from '@/components/common/ScopeFilter';
import StatusTabs from '@/components/common/StatusTabs';
import HeaderActions from '@/components/layouts/HeaderActions';
import DeviceListTable from '@/components/features/farm-owner/devices/DeviceListTable';
import { listDeviceRows, type DeviceRow } from '@/components/features/farm-owner/devices/deviceInventory';
import { compareAttention, needsAttention, NO_OPEN_ITEMS } from '@/components/features/farm-owner/devices/deviceWork';
import { DEVICE_DETAIL_PATH, type DeviceDetailState } from '@/components/features/farm-owner/devices/devices.constants';
import RemovedDevicesSection from '@/components/features/farm-owner/devices/RemovedDevicesSection';
import { Button, EmptyState, ErrorNotice, LoadingSkeleton, SectionCard } from '@/components/ui';
import { devicesDict } from '@/constants/devices.i18n';
import { DEVICE_SETUP_ROLES } from '@/constants/roles';
import { usePermission } from '@/hooks/common/usePermission';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useDeviceInventory } from '@/hooks/farm-owner/useDeviceInventory';
import { useDeviceOpenItems } from '@/hooks/farm-owner/useDeviceOpenItems';
import { useScopeFilter } from '@/hooks/shared/useScopeFilter';
import type { DeviceStatus } from '@/types';

// Tab "Cần xử lý" đứng ngay sau "Tất cả": thiết bị mất kết nối, camera lỗi hoặc còn cảnh báo thiết bị mở
const STATUS_TABS = ['all', 'attention', 'ONLINE', 'PENDING'] as const satisfies readonly (DeviceStatus | 'all' | 'attention')[];
type StatusTab = (typeof STATUS_TABS)[number];

// Thiết bị của Farm Owner và Farm Technician; Domain Expert chỉ xem
export default function FarmOwnerDevicesPage(): JSX.Element {
  const { t } = useTranslation(devicesDict);
  const navigate = useNavigate();
  // Farm Owner thiết lập thiết bị; chuyên gia chỉ xem trang này
  const canSetUp = usePermission(...DEVICE_SETUP_ROLES);
  const scope = useScopeFilter();
  const { houses, houseId, zones, zone, isLoading: isLoadingScope } = scope;
  // Tab mặc định chọn một lần, sau khi việc đang mở tải xong, để danh sách không tự nhảy tab giữa chừng
  const [chosenTab, setChosenTab] = useState<StatusTab>();
  const apiErrorMessage = useApiErrorMessage();
  const isTechnician = usePermission('FARM_TECHNICIAN');
  // Phạm vi: 1 nhà đang lọc hoặc mọi nhà của farm; chọn 1 Zone thì chỉ còn thiết bị của Zone đó
  const scopedHouses = useMemo(() => (houseId ? houses.filter(house => house._id === houseId) : houses), [houses, houseId]);
  const { inventory, isLoading, isError, refetch } = useDeviceInventory(scopedHouses, zones, zone?._id);

  // Cảnh báo thiết bị còn mở của các nhà trong phạm vi, để biết thiết bị nào cần xử lý
  const openItems = useDeviceOpenItems(useMemo(() => scopedHouses.map(house => house._id), [scopedHouses]), false);
  const { itemsByDevice } = openItems;

  const allRows = useMemo(() => listDeviceRows(inventory), [inventory]);
  // Dòng cần xử lý, mất kết nối lâu nhất lên đầu
  const attentionRows = useMemo(
    () => allRows
      .map(row => ({ row, device: row.device, items: itemsByDevice.get(row.device.id) ?? NO_OPEN_ITEMS }))
      .filter(entry => needsAttention(entry.device, entry.items))
      .sort(compareAttention)
      .map(entry => entry.row),
    [allRows, itemsByDevice],
  );
  // Số thiết bị theo từng tab, đếm 1 lần
  const counts = useMemo(() => {
    const result: Record<StatusTab, number> = { all: allRows.length, attention: attentionRows.length, ONLINE: 0, PENDING: 0 };
    for (const row of allRows) {
      if (row.device.status === 'ONLINE' || row.device.status === 'PENDING') result[row.device.status] += 1;
    }
    return result;
  }, [allRows, attentionRows]);
  const statusTab = chosenTab ?? 'all';
  const isSettled = !isLoadingScope && !isLoading && !openItems.isLoading;
  // Kỹ thuật viên vào "Cần xử lý" khi có việc, còn lại vào "Tất cả"; chốt lại để lượt tải sau không đổi tab
  useEffect(() => {
    if (chosenTab === undefined && isSettled) setChosenTab(isTechnician && counts.attention > 0 ? 'attention' : 'all');
  }, [chosenTab, isSettled, isTechnician, counts.attention]);
  const visibleRows = useMemo(() => {
    if (statusTab === 'all') return allRows;
    if (statusTab === 'attention') return attentionRows;
    return allRows.filter(row => row.device.status === statusTab);
  }, [allRows, attentionRows, statusTab]);

  // Id truyền qua history state, không đưa lên URL
  const openDetail = useCallback((row: DeviceRow) => {
    const state: DeviceDetailState = { houseId: row.house._id, deviceId: row.device.id };
    navigate(DEVICE_DETAIL_PATH, { state });
  }, [navigate]);

  let body = (
    <>
      {openItems.isError && (
        <ErrorNotice onRetry={openItems.refetch}>{apiErrorMessage(openItems.error, t('open.loadFailed'))}</ErrorNotice>
      )}
      <StatusTabs
        variant="underline"
        ariaLabel={t('list.filterStatus')}
        value={statusTab}
        onChange={setChosenTab}
        tabs={STATUS_TABS.map(id => ({ id, label: t(`tab.${id}`), badge: id === 'attention' ? counts.attention : undefined }))}
      />
      <DeviceListTable rows={visibleRows} hasAnyDevice={allRows.length > 0} onOpen={openDetail} />
    </>
  );
  // Kỹ thuật viên chưa có tab mặc định thì chờ, kẻo thấy "Tất cả" rồi bị chuyển sang "Cần xử lý"
  if (isLoadingScope || isLoading || (isTechnician && chosenTab === undefined && openItems.isLoading)) body = <LoadingSkeleton count={4} className="h-16 w-full" />;
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
      </HeaderActions>

      <SectionCard
        description={t('list.short')}
        help={t('list.help')}
        action={canSetUp && (
          <Button size="sm" onClick={() => navigate('/devices/onboarding')}>
            <PlusIcon size={14} weight="bold" />
            {t('list.setup')}
          </Button>
        )}
      >
        {body}
      </SectionCard>
      {/* thiết bị gỡ nhầm khôi phục được trong 24 giờ */}
      <RemovedDevicesSection />
    </div>
  );
}
