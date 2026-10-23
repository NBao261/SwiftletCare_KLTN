import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import '@/lib/chartTheme';

import ScopeFilter from '@/components/common/ScopeFilter';
import HeaderActions from '@/components/layouts/HeaderActions';
import AutomationCard from '@/components/features/farm-owner/analytics/AutomationCard';
import BirdHourlyCard from '@/components/features/farm-owner/analytics/BirdHourlyCard';
import BirdWeeklyCard from '@/components/features/farm-owner/analytics/BirdWeeklyCard';
import CompareZonesCard from '@/components/features/farm-owner/analytics/CompareZonesCard';
import CorrelationCard from '@/components/features/farm-owner/analytics/CorrelationCard';
import EnvVariationCard from '@/components/features/farm-owner/analytics/EnvVariationCard';
import ForecastCard from '@/components/features/farm-owner/analytics/ForecastCard';
import HealthReportCard from '@/components/features/farm-owner/analytics/HealthReportCard';
import RelayOverrideHistoryCard from '@/components/features/farm-owner/analytics/RelayOverrideHistoryCard';
import { Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import { analyticsDict } from '@/constants/analytics.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useScopeFilter } from '@/hooks/farm-owner/useScopeFilter';
import { useZone } from '@/hooks/shared/useFarms';

// Trang Phân tích của Farm Owner — ANALYTICS-FR-001..003/005/008..011, ENV-FR-019, EXPERT-FR-005/006
export default function FarmOwnerAnalyticsPage(): JSX.Element {
  const { t } = useTranslation(analyticsDict);
  // Khung lọc Nhà + Zone lưu ở store chung, giữ nguyên khi chuyển trang
  const scope = useScopeFilter();
  const { farms, houses, houseId, houseName, zones, zone, isLoading, isError, refetch } = scope;
  // Phạm vi đếm chim (theo nhà) và Zone đang tính: theo khung lọc, chưa lọc thì gồm tất cả
  const houseIds = useMemo(() => (houseId ? [houseId] : houses.map(house => house._id)), [houseId, houses]);
  const scopedZoneIds = useMemo(() => (zone ? [zone._id] : zones.map(item => item._id)), [zone, zones]);
  const scopeLabel = houseName || t('common.allHouses');
  // Ngưỡng lấy từ chi tiết Zone (luôn mới), danh sách Zone được giữ cache lâu hơn
  const { data: zoneDetail } = useZone(zone?._id);

  if (isLoading) {
    return <LoadingSkeleton count={4} className="h-32 w-full" />;
  }

  if (isError) {
    return (
      <EmptyState
        title={t('page.errorTitle')}
        action={<Button variant="secondary" onClick={refetch}>{t('common.retry')}</Button>}
      />
    );
  }

  if (farms.length === 0) {
    return (
      <EmptyState
        title={t('page.noFarmTitle')}
        description={t('page.noFarmDesc')}
        action={(
          <Link to="/farms">
            <Button>{t('page.goFarms')}</Button>
          </Link>
        )}
      />
    );
  }

  // Thân trang theo phạm vi đang lọc
  let body = (
    <EmptyState
      title={houseId ? t('page.noHouseZoneTitle') : t('page.noZoneTitle')}
      description={t('page.noZoneDesc')}
      action={(
        <Link to="/farms">
          <Button>{t('page.goFarms')}</Button>
        </Link>
      )}
    />
  );

  // Tất cả Zone: chỉ các khung hiện được nhiều Zone/nhà (lịch sử can thiệp tay, đếm chim cộng các nhà, so sánh Zone)
  if (zones.length > 0 && !zone) {
    body = (
      <>
        <RelayOverrideHistoryCard zoneIds={scopedZoneIds} />
        <BirdHourlyCard houseIds={houseIds} scopeLabel={scopeLabel} />
        <BirdWeeklyCard houseIds={houseIds} scopeLabel={scopeLabel} />
        <CompareZonesCard zones={zones} />
      </>
    );
  }

  // 1 Zone: đủ mọi khung
  if (zone) {
    body = (
      <>
        <AutomationCard zoneId={zone._id} zoneName={zone.name} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <HealthReportCard zoneId={zone._id} />
          <RelayOverrideHistoryCard zoneIds={scopedZoneIds} />
        </div>

        <EnvVariationCard
          zoneId={zone._id}
          thresholds={zoneDetail?.thresholds ?? zone.thresholds}
          thresholdHistory={zoneDetail?.threshold_history ?? zone.threshold_history}
        />

        <ForecastCard zoneId={zone._id} />

        {/* Đếm chim là của cả nhà yến chứa Zone (SRS v2.1.8) */}
        <BirdHourlyCard houseIds={[zone.house_id]} scopeLabel={zone.houseName} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <BirdWeeklyCard houseIds={[zone.house_id]} scopeLabel={zone.houseName} />
          <CorrelationCard zoneId={zone._id} />
        </div>

        <CompareZonesCard zones={zones} />
      </>
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
