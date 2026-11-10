import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { healthDayApi, type HealthDayScope } from '@/apis/shared/healthDays.api';
import ScopeFilter from '@/components/common/ScopeFilter';
import TableEmptyState from '@/components/common/TableEmptyState';
import HealthDayDrawer from '@/components/features/farm-owner/health/HealthDayDrawer';
import HealthDayTable from '@/components/features/farm-owner/health/HealthDayTable';
import HealthLevelsModal from '@/components/features/farm-owner/health/HealthLevelsModal';
import HealthRatingModal from '@/components/features/farm-owner/health/HealthRatingModal';
import HealthReportSection from '@/components/features/farm-owner/health/HealthReportSection';
import { HOVER_DARK_BUTTON, shiftDate, vietnamDate } from '@/components/features/farm-owner/health/healthDay.utils';
import HeaderActions from '@/components/layouts/HeaderActions';
import { Button, EmptyState, FilterChip, SectionCard } from '@/components/ui';
import { healthDict } from '@/constants/health.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useScopeFilter } from '@/hooks/farm-owner/useScopeFilter';
import { useFarm } from '@/hooks/shared/useFarms';
import { useHealthDays } from '@/hooks/shared/useHealthDays';
import { cn } from '@/lib/cn';
import { useToastStore } from '@/stores/toastStore';
import type { HouseHealthDay } from '@/types';

// Khoảng ngày xem được; backend cho tối đa 31 ngày một lần đọc
const RANGE_DAYS = [7, 14, 30] as const;
type RangeDays = (typeof RANGE_DAYS)[number];
// Tên tab trùng tiền tố khoá tiêu đề thẻ (table.title, report.title)
const TABS = ['table', 'report'] as const;
type HealthTab = (typeof TABS)[number];

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
  // SRS 4.2.0 (BR-31, EXPERT-FR-012): chỉ Farm Owner đánh giá ngày; Domain Expert xem đủ trạng thái (my_rating_state null), backend trả 403 khi chấm
  const canRate = !isExpert;
  const push = useToastStore(state => state.push);
  const apiErrorMessage = useApiErrorMessage();

  const [rangeDays, setRangeDays] = useState<RangeDays>(7);
  const [isToRateOnly, setIsToRateOnly] = useState(false);
  const [ratingDay, setRatingDay] = useState<HouseHealthDay | null>(null);
  const [viewDay, setViewDay] = useState<HouseHealthDay | null>(null);
  const [isLevelsOpen, setIsLevelsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // Tab nằm trên URL (?tab=report) để từ trang chi tiết báo cáo quay lại đúng tab; giữ các tham số khác (?preview)
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: HealthTab = searchParams.get('tab') === 'report' ? 'report' : 'table';
  const setTab = (value: HealthTab) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (value === 'table') next.delete('tab');
    else next.set('tab', value);
    return next;
  }, { replace: true });

  const to = vietnamDate();
  const from = shiftDate(to, -(rangeDays - 1));
  const farmIds = useMemo(() => (scope.farmId ? [scope.farmId] : scope.farms.map(farm => farm._id)), [scope.farmId, scope.farms]);
  const { days, isLoading, isError, error, refetch } = useHealthDays({ farmIds, houseId: scope.houseId, from, to });
  const pendingDays = useMemo(() => days.filter(day => day.my_rating_state === 'PENDING'), [days]);
  const shownDays = canRate && isToRateOnly ? pendingDays : days;

  // BR-22: Farm Owner chỉ sửa mức khi farm chưa có chuyên gia; backend vẫn là chốt chặn (403)
  const house = scope.houses.find(item => item._id === scope.houseId);
  const { data: houseFarm } = useFarm(house?.farm_id);
  const farmHasExpert = (houseFarm?.members ?? []).some(member => member.role === 'DOMAIN_EXPERT');
  const canEditLevels = isExpert || !farmHasExpert;

  // CSV và báo cáo theo nhà hoặc farm đang lọc; xem tất cả trang trại mà chỉ có 1 farm thì dùng farm đó
  let csvScope: HealthDayScope | null = null;
  if (scope.houseId) csvScope = { houseId: scope.houseId };
  else if (scope.farmId) csvScope = { farmId: scope.farmId };
  else if (scope.farms.length === 1) csvScope = { farmId: scope.farms[0]._id };

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

  // Tab pill như AdminUsersPage, trên thẻ: bảng ngày và bảng báo cáo, mỗi lúc 1 thẻ
  const tabs = (
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
          {t(`${value}.title`)}
        </button>
      ))}
    </div>
  );

  if (scope.farms.length === 0 && !scope.isLoading) {
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
      {tabs}

      {/* Thẻ trắng kéo hết chiều cao còn lại của màn hình */}
      {tab === 'table' ? (
        <SectionCard
          className="flex-1"
          title={t('table.title')}
          description={t(canRate ? 'table.subtitle' : 'table.subtitleExpert')}
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                className={HOVER_DARK_BUTTON}
                disabled={!house}
                title={house ? undefined : t('page.levelsNeedHouse')}
                onClick={() => setIsLevelsOpen(true)}
              >
                {t('page.levels')}
              </Button>
              <Button variant="secondary" size="sm" className={HOVER_DARK_BUTTON} disabled={!csvScope} loading={isExporting} onClick={() => void handleExport()}>
                {t('page.export')}
              </Button>
            </div>
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canRate ? (
              <div className="flex flex-wrap gap-2">
                <FilterChip active={!isToRateOnly} label={t('filter.all')} onClick={() => setIsToRateOnly(false)} />
                <FilterChip active={isToRateOnly} label={t('filter.toRate', { n: pendingDays.length })} onClick={() => setIsToRateOnly(true)} />
              </div>
            ) : <span />}
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
            <HealthDayTable days={shownDays} canRate={canRate} onRate={openRating} onView={openView} />
          )}
        </SectionCard>
      ) : (
        <HealthReportSection scope={csvScope} house={house ? { id: house._id, name: house.name } : null} />
      )}

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
