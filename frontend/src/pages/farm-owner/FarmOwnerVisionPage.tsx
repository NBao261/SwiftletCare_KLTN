import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

import ScopeFilter from '@/components/common/ScopeFilter';
import StatusTabs from '@/components/common/StatusTabs';
import HeaderActions from '@/components/layouts/HeaderActions';
import BirdHourlyCard from '@/components/features/farm-owner/analytics/BirdHourlyCard';
import BirdWeeklyCard from '@/components/features/farm-owner/analytics/BirdWeeklyCard';
import FlockTrendCard from '@/components/features/farm-owner/analytics/FlockTrendCard';
import BirdDailyCharts from '@/components/features/farm-owner/vision/BirdDailyCharts';
import BirdTodayCard from '@/components/features/farm-owner/vision/BirdTodayCard';
import LiveCameraCard from '@/components/features/farm-owner/vision/LiveCameraCard';
import { Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useScopeFilter } from '@/hooks/shared/useScopeFilter';
import { cn } from '@/lib/cn';

const TABS = ['today', 'trend'] as const;
type VisionTab = typeof TABS[number];

// Chim ra vào: tab Hôm nay (camera cửa, số chim ra buổi sáng và về buổi chiều, theo giờ) và tab Xu hướng (theo ngày, theo tuần, quy mô đàn); tính theo nhà yến
export default function FarmOwnerVisionPage(): JSX.Element {
  const { t } = useTranslation(dashboardDict);
  // Khung lọc lưu ở store chung, giữ nguyên khi chuyển trang; trang này chỉ lọc theo nhà nên ô Zone khoá
  const scope = useScopeFilter();
  const { houses, houseId, houseName, isLoading, isError, refetch } = scope;
  // Phóng to camera: khung video full chiều ngang, thẻ số đếm chuyển xuống dưới, 3 số xếp ngang
  const [isCameraExpanded, setIsCameraExpanded] = useState(false);
  // Tab nằm trên URL (?tab=trend) để quay lại đúng nhóm, mặc định Hôm nay
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: VisionTab = TABS.find(value => value === searchParams.get('tab')) ?? 'today';
  const setTab = (value: VisionTab) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (value === 'today') next.delete('tab');
    else next.set('tab', value);
    return next;
  }, { replace: true });
  // Đếm chim theo nhà: 1 nhà đang lọc, hoặc cộng mọi nhà của farm
  const houseIds = useMemo(() => (houseId ? [houseId] : houses.map(house => house._id)), [houseId, houses]);

  if (isLoading) {
    return <LoadingSkeleton count={3} className="h-32 w-full" />;
  }

  if (isError) {
    return (
      <EmptyState
        title={t('page.zoneErrorTitle')}
        description={t('page.zoneErrorDesc')}
        action={<Button variant="secondary" onClick={refetch}>{t('log.retry')}</Button>}
      />
    );
  }

  const houseFilter = <ScopeFilter scope={scope} lockZone />;
  // Camera là của từng nhà nên chỉ hiện khi đã chọn 1 nhà; số đếm và xu hướng cộng được nhiều nhà
  const isStatsHorizontal = isCameraExpanded || !houseId;

  // Thân trang: farm chưa có nhà, hoặc camera và số đếm của phạm vi đang lọc
  let body = scope.farmId
    ? <EmptyState title={t('page.noHouseInFarmTitle')} description={t('page.noHouseInFarmDesc')} />
    : <EmptyState title={t('page.noZoneTitle')} description={t('page.noZoneDesc')} />;
  if (houseIds.length > 0) {
    const scopeLabel = houseName || t('page.allHouses');
    const today: ReactNode = (
      <>
        <div className={cn('grid grid-cols-1 gap-5', houseId && !isCameraExpanded && 'xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]')}>
          {houseId && (
            <LiveCameraCard
              houseId={houseId}
              houseName={houseName}
              expanded={isCameraExpanded}
              onToggleExpand={() => setIsCameraExpanded(expanded => !expanded)}
              showTodayCounts={false}
            />
          )}
          <BirdTodayCard houseIds={houseIds} houseName={houseName} horizontal={isStatsHorizontal} />
        </div>

        <BirdHourlyCard houseIds={houseIds} scopeLabel={scopeLabel} />
      </>
    );
    // Quy mô đàn chỉ tính cho một nhà; chọn nhiều nhà thì khung tỷ lệ chim về chiếm cả hàng
    const trend: ReactNode = (
      <>
        <BirdDailyCharts houseIds={houseIds} />
        <div className={cn('grid grid-cols-1 gap-5', houseId && 'xl:grid-cols-2')}>
          <BirdWeeklyCard houseIds={houseIds} scopeLabel={scopeLabel} />
          {houseId && <FlockTrendCard houseId={houseId} houseName={houseName} />}
        </div>
      </>
    );
    body = (
      <>
        <StatusTabs
          ariaLabel={t('vision.tabs')}
          value={tab}
          onChange={setTab}
          tabs={TABS.map(id => ({ id, label: t(id === 'today' ? 'vision.tabToday' : 'vision.tabTrend') }))}
        />
        {tab === 'today' ? today : trend}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Khung lọc trên header, dưới xl xuống hàng riêng */}
      <HeaderActions>
        {houseFilter}
      </HeaderActions>

      {body}
    </div>
  );
}
