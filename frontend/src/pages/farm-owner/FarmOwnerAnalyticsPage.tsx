import { useMemo, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '@/lib/chartTheme';

import ScopeFilter from '@/components/common/ScopeFilter';
import HeaderActions from '@/components/layouts/HeaderActions';
import AutomationCard from '@/components/features/farm-owner/analytics/AutomationCard';
import BirdHourlyCard from '@/components/features/farm-owner/analytics/BirdHourlyCard';
import BirdWeeklyCard from '@/components/features/farm-owner/analytics/BirdWeeklyCard';
import CompareZonesCard from '@/components/features/farm-owner/analytics/CompareZonesCard';
import CorrelationCard from '@/components/features/farm-owner/analytics/CorrelationCard';
import EnergyCard from '@/components/features/farm-owner/analytics/EnergyCard';
import EnvVariationCard from '@/components/features/farm-owner/analytics/EnvVariationCard';
import FlockTrendCard from '@/components/features/farm-owner/analytics/FlockTrendCard';
import ForecastCard from '@/components/features/farm-owner/analytics/ForecastCard';
import HealthReportCard from '@/components/features/farm-owner/analytics/HealthReportCard';
import RelayOverrideHistoryCard from '@/components/features/farm-owner/analytics/RelayOverrideHistoryCard';
import { Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import { analyticsDict } from '@/constants/analytics.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useScopeFilter } from '@/hooks/farm-owner/useScopeFilter';
import { useZone } from '@/hooks/shared/useFarms';
import { cn } from '@/lib/cn';

const TABS = ['env', 'birds', 'ops'] as const;
type AnalyticsTab = typeof TABS[number];

// 2 khung cạnh nhau trên màn rộng; thiếu 1 khung thì khung còn lại chiếm cả hàng
function pair(left: ReactNode, right: ReactNode): ReactNode {
  if (!right) return left;
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {left}
      {right}
    </div>
  );
}

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
  // Tab nằm trên URL (?tab=birds) để quay lại đúng nhóm, mặc định Môi trường
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: AnalyticsTab = TABS.find(value => value === searchParams.get('tab')) ?? 'env';
  const setTab = (value: AnalyticsTab) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (value === 'env') next.delete('tab');
    else next.set('tab', value);
    return next;
  }, { replace: true });

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
  let body: ReactNode = (
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

  // Mỗi tab một nhóm khung; khung Zone khi lọc 1 Zone, đàn và điện năng (ANALYTICS-FR-002, 017) khi lọc 1 nhà
  if (zones.length > 0) {
    // Đếm chim là của cả nhà yến chứa Zone (SRS v2.1.8)
    const birdHouseIds = zone ? [zone.house_id] : houseIds;
    const birdLabel = zone ? zone.houseName : scopeLabel;
    const flockTrend = houseId ? <FlockTrendCard houseId={houseId} houseName={houseName} /> : null;
    const energy = houseId ? <EnergyCard houseId={houseId} houseName={houseName} /> : null;

    if (tab === 'env') {
      body = (
        <>
          {zone && (
            <>
              <EnvVariationCard
                zoneId={zone._id}
                thresholds={zoneDetail?.thresholds ?? zone.thresholds}
                thresholdHistory={zoneDetail?.threshold_history ?? zone.threshold_history}
              />
              <ForecastCard zoneId={zone._id} />
            </>
          )}
          <CompareZonesCard zones={zones} />
        </>
      );
    } else if (tab === 'birds') {
      body = (
        <>
          <BirdHourlyCard houseIds={birdHouseIds} scopeLabel={birdLabel} />
          {/* Tỷ lệ về và quy mô đàn trước, tương quan (phân tích sâu) sau cùng */}
          {pair(<BirdWeeklyCard houseIds={birdHouseIds} scopeLabel={birdLabel} />, flockTrend)}
          {zone && <CorrelationCard zoneId={zone._id} />}
        </>
      );
    } else {
      // Vận hành: mỗi khung 1 hàng đủ rộng; tóm tắt và kết luận trước, nhật ký chi tiết sau cùng
      body = (
        <>
          {zone && <HealthReportCard zoneId={zone._id} />}
          {zone && <AutomationCard zoneId={zone._id} zoneName={zone.name} />}
          {energy}
          <RelayOverrideHistoryCard zoneIds={scopedZoneIds} />
        </>
      );
    }
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

      {zones.length > 0 && (
        <div className="inline-flex gap-1 self-start rounded-full bg-warmGray/10 p-1" role="tablist" aria-label={t('page.tabs')}>
          {TABS.map(value => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                'h-9 whitespace-nowrap rounded-full px-4 text-small font-semibold transition-colors duration-150',
                tab === value ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
              )}
            >
              {t(`tab.${value}`)}
            </button>
          ))}
        </div>
      )}

      {body}
    </div>
  );
}
