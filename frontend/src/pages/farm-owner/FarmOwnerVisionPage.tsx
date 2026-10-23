import { useMemo, useState } from 'react';

import ScopeFilter from '@/components/common/ScopeFilter';
import HeaderActions from '@/components/layouts/HeaderActions';
import BirdStatsCards from '@/components/features/farm-owner/vision/BirdStatsCards';
import BirdTrendChart from '@/components/features/farm-owner/vision/BirdTrendChart';
import LiveCameraCard from '@/components/features/farm-owner/vision/LiveCameraCard';
import SavedEventsTable from '@/components/features/farm-owner/vision/SavedEventsTable';
import { Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import { dashboardDict } from '@/constants/dashboard.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useScopeFilter } from '@/hooks/farm-owner/useScopeFilter';
import { cn } from '@/lib/cn';

// Giám sát đàn chim — VISION-FR-006/008/009/010/011/013; camera và số đếm chim tính theo nhà yến (SRS v2.1.8)
export default function FarmOwnerVisionPage(): JSX.Element {
  const { t } = useTranslation(dashboardDict);
  // Khung lọc lưu ở store chung, giữ nguyên khi chuyển trang; trang này chỉ lọc theo nhà nên ô Zone khoá
  const scope = useScopeFilter();
  const { houses, houseId, houseName, isLoading, isError, refetch } = scope;
  // Phóng to camera: khung video full chiều ngang, 3 thẻ số đếm chuyển xuống hàng ngang bên dưới
  const [isCameraExpanded, setIsCameraExpanded] = useState(false);
  // Đếm chim theo nhà (SRS v2.1.8): 1 nhà đang lọc, hoặc cộng mọi nhà của farm
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
    body = (
      <>
        <div className={cn('grid grid-cols-1 gap-5', houseId && !isCameraExpanded && 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
          {houseId && (
            <LiveCameraCard
              houseId={houseId}
              houseName={houseName}
              expanded={isCameraExpanded}
              onToggleExpand={() => setIsCameraExpanded(expanded => !expanded)}
            />
          )}
          <BirdStatsCards houseIds={houseIds} horizontal={isStatsHorizontal} />
        </div>

        <BirdTrendChart houseIds={houseIds} />

        <SavedEventsTable />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Bộ lọc nhà nằm trên header từ sm trở lên; mobile header chật nên đặt đầu trang */}
      <HeaderActions>
        <div className="hidden sm:block">{houseFilter}</div>
      </HeaderActions>
      <div className="sm:hidden">{houseFilter}</div>

      {body}
    </div>
  );
}
