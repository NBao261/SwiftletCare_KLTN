import { type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '@/lib/chartTheme';

import ScopeFilter from '@/components/common/ScopeFilter';
import HeaderActions from '@/components/layouts/HeaderActions';
import AutomationCard from '@/components/features/farm-owner/analytics/AutomationCard';
import CompareZonesCard from '@/components/features/farm-owner/analytics/CompareZonesCard';
import CorrelationCard from '@/components/features/farm-owner/analytics/CorrelationCard';
import EnergyCard from '@/components/features/farm-owner/analytics/EnergyCard';
import EnvVariationCard from '@/components/features/farm-owner/analytics/EnvVariationCard';
import ForecastCard from '@/components/features/farm-owner/analytics/ForecastCard';
import HealthReportCard from '@/components/features/farm-owner/analytics/HealthReportCard';
import HouseComparisonSection from '@/components/features/farm-owner/analytics/HouseComparisonSection';
import { Button, EmptyState, LoadingSkeleton } from '@/components/ui';
import NoHouseAssignedState from '@/components/common/NoHouseAssignedState';
import { analyticsDict } from '@/constants/analytics.i18n';
import { FARM_SIDE_ROLES } from '@/constants/roles';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useScopeFilter } from '@/hooks/shared/useScopeFilter';
import { useZone } from '@/hooks/shared/useFarms';
import { cn } from '@/lib/cn';

const TABS = ['env', 'ops', 'houses'] as const;
type AnalyticsTab = typeof TABS[number];

// Trang Phân tích của Farm Owner: /008..011
export default function FarmOwnerAnalyticsPage(): JSX.Element {
  const { t } = useTranslation(analyticsDict);
  // Khung lọc Nhà + Zone lưu ở store chung, giữ nguyên khi chuyển trang
  const scope = useScopeFilter();
  const { farms, houseId, houseName, zones, zone, isLoading, isError, refetch } = scope;
  // Ngưỡng lấy từ chi tiết Zone (luôn mới), danh sách Zone được giữ cache lâu hơn
  const { data: zoneDetail } = useZone(zone?._id);
  // Tab nằm trên URL (?tab=ops) để quay lại đúng nhóm, mặc định Môi trường
  const [searchParams, setSearchParams] = useSearchParams();
  // So sánh nhà là của chủ nhà yến và Chuyên gia (kỹ thuật viên không đọc tổng quan trang trại)
  const canCompare = usePermission(...FARM_SIDE_ROLES);
  const isTechnician = usePermission('FARM_TECHNICIAN');
  const visibleTabs = TABS.filter(value => value !== 'houses' || canCompare);
  const tab: AnalyticsTab = visibleTabs.find(value => value === searchParams.get('tab')) ?? 'env';
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
    if (isTechnician) return <NoHouseAssignedState />;
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

  // So sánh nhà tính trong 1 trang trại: chưa chọn mà chỉ có 1 trang trại thì dùng luôn trang trại đó
  const comparisonFarmId = scope.farmId || (farms.length === 1 ? farms[0]._id : '');

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

  // Mỗi tab một nhóm khung; khung Zone khi lọc 1 Zone, đàn và điện năng khi lọc 1 nhà
  if (tab === 'houses') {
    body = <HouseComparisonSection farmId={comparisonFarmId} />;
  } else if (zones.length > 0) {
    const energy = houseId ? <EnergyCard houseId={houseId} houseName={houseName} /> : null;
    // biểu đồ theo thời gian là của một Zone: chưa chọn Zone thì nói rõ chỗ chọn, không để trống
    const pickZoneHint = zone ? null : (
      <p className="rounded-2xl border border-dashed border-warmGray/30 px-6 py-5 text-sm text-warmGray">{t('page.pickZoneHint')}</p>
    );

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
          {/* Môi trường ảnh hưởng tới tỷ lệ chim về: phân tích sâu nên đứng sau cùng */}
          {zone && <CorrelationCard zoneId={zone._id} />}
          {pickZoneHint}
        </>
      );
    } else {
      // Vận hành tự động: tóm tắt và kết luận, điện năng; lịch sử điều khiển tay nằm ở trang Điều khiển tay
      body = (
        <>
          {zone && <HealthReportCard houseId={zone.house_id} zoneId={zone._id} />}
          {zone && <AutomationCard zoneId={zone._id} />}
          {pickZoneHint}
          {energy}
        </>
      );
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Khung lọc trên header, dưới xl xuống hàng riêng */}
      <HeaderActions>
        <ScopeFilter scope={scope} lockHouse={tab === 'houses'} />
      </HeaderActions>

      {(zones.length > 0 || tab === 'houses') && (
        <div className="inline-flex gap-1 self-start rounded-full bg-warmGray/10 p-1" role="tablist" aria-label={t('page.tabs')}>
          {visibleTabs.map(value => (
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
