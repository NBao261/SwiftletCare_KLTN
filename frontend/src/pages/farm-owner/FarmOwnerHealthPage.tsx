import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { healthDayApi, type HealthDayScope } from '@/apis/shared/healthDays.api';
import ScopeFilter from '@/components/common/ScopeFilter';
import TableEmptyState from '@/components/common/TableEmptyState';
import HealthDayDrawer from '@/components/features/farm-owner/health/HealthDayDrawer';
import HealthDayTable from '@/components/features/farm-owner/health/HealthDayTable';
import HealthLevelsModal from '@/components/features/farm-owner/health/HealthLevelsModal';
import HealthRatingModal from '@/components/features/farm-owner/health/HealthRatingModal';
import HealthReportSection from '@/components/features/farm-owner/health/HealthReportSection';
import { shiftDate, vietnamDate } from '@/components/features/farm-owner/health/healthDay.utils';
import HeaderActions from '@/components/layouts/HeaderActions';
import { Button, EmptyState, FilterChip, SectionCard } from '@/components/ui';
import { healthDict } from '@/constants/health.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useScopeFilter } from '@/hooks/farm-owner/useScopeFilter';
import { useFarm } from '@/hooks/shared/useFarms';
import { useHealthDays } from '@/hooks/shared/useHealthDays';
import { isHealthPreview, setPreviewHouses } from '@/data/healthPreview.data';
import { useToastStore } from '@/stores/toastStore';
import type { HouseHealthDay } from '@/types';

// Khoảng ngày xem được; backend cho tối đa 31 ngày một lần đọc
const RANGE_DAYS = [7, 14, 30] as const;
type RangeDays = (typeof RANGE_DAYS)[number];

// Tải blob CSV backend trả về (đã có BOM, ngôn ngữ theo lang)
function saveCsv(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// MF-11 — trạng thái sức khỏe theo ngày của nhà yến và đánh giá ngày độc lập (BR-31); Farm Owner và Domain Expert
export default function FarmOwnerHealthPage(): JSX.Element {
  const { t, lang } = useTranslation(healthDict);
  // Trạng thái tính theo nhà yến nên chỉ lọc tới nhà (ô Zone khoá)
  const scope = { ...useScopeFilter(), zone: undefined };
  const isExpert = usePermission('DOMAIN_EXPERT');
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();

  const [rangeDays, setRangeDays] = useState<RangeDays>(7);
  const [isToRateOnly, setIsToRateOnly] = useState(false);
  const [ratingDay, setRatingDay] = useState<HouseHealthDay | null>(null);
  const [viewDay, setViewDay] = useState<HouseHealthDay | null>(null);
  const [isLevelsOpen, setIsLevelsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // /health?preview: dữ liệu giả (src/data/healthPreview.data.ts) theo nhà thật của tài khoản; chờ tải xong nhà để không lưu cache rỗng
  const isPreview = isHealthPreview();
  if (isPreview) setPreviewHouses(scope.houses.map(item => ({ _id: item._id, name: item.name, farm_id: item.farm_id })));
  const isPreviewWaiting = isPreview && scope.isLoading;
  const isPreviewNoFarm = isPreview && !scope.isLoading && scope.farms.length === 0;

  const to = vietnamDate();
  const from = shiftDate(to, -(rangeDays - 1));
  const realFarmIds = useMemo(() => (scope.farmId ? [scope.farmId] : scope.farms.map(farm => farm._id)), [scope.farmId, scope.farms]);
  const farmIds = isPreviewWaiting ? [] : isPreviewNoFarm ? ['preview-farm'] : realFarmIds;
  const { days, isLoading, isError, error, refetch } = useHealthDays({ farmIds, houseId: scope.houseId, from, to });
  const pendingDays = useMemo(() => days.filter(day => day.my_rating_state === 'PENDING'), [days]);
  const shownDays = isToRateOnly ? pendingDays : days;

  // BR-22: Farm Owner chỉ sửa mức khi farm chưa có chuyên gia; backend vẫn là chốt chặn (403)
  const house = scope.houses.find(item => item._id === scope.houseId);
  const { data: houseFarm } = useFarm(house?.farm_id);
  const farmHasExpert = (houseFarm?.members ?? []).some(member => member.role === 'DOMAIN_EXPERT');
  const canEditLevels = isExpert || !farmHasExpert;

  // CSV và báo cáo theo nhà hoặc farm đang lọc; xem tất cả trang trại mà chỉ có 1 farm thì dùng farm đó
  const csvScope: HealthDayScope | null = isPreviewWaiting ? null
    : isPreviewNoFarm ? { farmId: 'preview-farm' }
      : scope.houseId ? { houseId: scope.houseId }
        : scope.farmId ? { farmId: scope.farmId }
          : scope.farms.length === 1 ? { farmId: scope.farms[0]._id } : null;

  const openRating = useCallback((day: HouseHealthDay) => setRatingDay(day), []);
  const openView = useCallback((day: HouseHealthDay) => setViewDay(day), []);

  async function handleExport(): Promise<void> {
    if (!csvScope) return;
    setIsExporting(true);
    try {
      const response = await healthDayApi.downloadCsv({ ...csvScope, from, to, lang });
      saveCsv(response.data, `suc-khoe-nha-yen-${from}-${to}.csv`);
    } catch (exportError) {
      push(apiErrorMessage(exportError, t('page.exportFailed')), 'error');
    } finally {
      setIsExporting(false);
    }
  }

  const filter = (
    <>
      <HeaderActions>
        <div className="hidden sm:block">
          <ScopeFilter scope={scope} lockZone />
        </div>
      </HeaderActions>
      <div className="sm:hidden">
        <ScopeFilter scope={scope} lockZone />
      </div>
    </>
  );

  if (scope.farms.length === 0 && !scope.isLoading && !isPreview) {
    return (
      <EmptyState
        title={t('page.noFarmTitle')}
        description={t('page.noFarmDesc')}
        action={isExpert ? undefined : (
          <Link to="/farms">
            <Button>{t('page.goFarms')}</Button>
          </Link>
        )}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {filter}

      {/* Thẻ trắng kéo hết chiều cao còn lại của màn hình */}
      <SectionCard
        className="flex-1"
        title={t('table.title')}
        description={t('table.subtitle')}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!house}
              title={house ? undefined : t('page.levelsNeedHouse')}
              onClick={() => setIsLevelsOpen(true)}
            >
              {t('page.levels')}
            </Button>
            <Button variant="secondary" size="sm" disabled={!csvScope} loading={isExporting} onClick={() => void handleExport()}>
              {t('page.export')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={!isToRateOnly} label={t('filter.all')} onClick={() => setIsToRateOnly(false)} />
            <FilterChip active={isToRateOnly} label={t('filter.toRate', { n: pendingDays.length })} onClick={() => setIsToRateOnly(true)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGE_DAYS.map(value => (
              <FilterChip key={value} active={rangeDays === value} label={t(`filter.days${value}`)} onClick={() => setRangeDays(value)} />
            ))}
          </div>
        </div>

        {/* Đang tải và rỗng: khung viền đứt (như EmptyState) chứa hình minh hoạ bảng của Dashboard, giãn hết phần còn lại của thẻ */}
        {isLoading || scope.isLoading ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-warmGray/30 px-6 py-12 motion-safe:animate-pulse" role="status">
            <TableEmptyState title={t('table.loading')} />
          </div>
        ) : isError ? (
          <EmptyState
            title={t('page.errorTitle')}
            description={apiErrorMessage(error)}
            action={<Button variant="secondary" size="sm" onClick={refetch}>{t('page.retry')}</Button>}
          />
        ) : shownDays.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-warmGray/30 px-6 py-12">
            <TableEmptyState
              title={isToRateOnly ? t('table.emptyToRateTitle') : t('table.emptyTitle')}
              description={isToRateOnly ? t('table.emptyToRateHint') : t('table.emptyHint')}
            />
          </div>
        ) : (
          <HealthDayTable days={shownDays} onRate={openRating} onView={openView} />
        )}
      </SectionCard>

      <HealthReportSection scope={csvScope} house={house ? { id: house._id, name: house.name } : null} />

      <HealthRatingModal day={ratingDay} onClose={() => setRatingDay(null)} onRevealed={setViewDay} />
      <HealthDayDrawer day={viewDay} onClose={() => setViewDay(null)} onChanged={setViewDay} />
      {house && (
        <HealthLevelsModal
          open={isLevelsOpen}
          onClose={() => setIsLevelsOpen(false)}
          house={{ id: house._id, name: house.name }}
          canEdit={canEditLevels}
          readOnlyNote={t('levels.readOnlyExpert')}
        />
      )}
    </div>
  );
}
