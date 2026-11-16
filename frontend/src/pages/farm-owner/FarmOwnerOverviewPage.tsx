import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SortAscendingIcon, SortDescendingIcon } from '@phosphor-icons/react';

import ScopeFilter from '@/components/common/ScopeFilter';
import TableEmptyState from '@/components/common/TableEmptyState';
import FarmOverviewSummary from '@/components/features/farm-owner/overview/FarmOverviewSummary';
import HouseComparisonTable from '@/components/features/farm-owner/overview/HouseComparisonTable';
import HouseOverviewCard from '@/components/features/farm-owner/overview/HouseOverviewCard';
import HeaderActions from '@/components/layouts/HeaderActions';
import { Button, ClearFiltersButton, EmptyState, LoadingSkeleton, SectionCard, SelectMenu } from '@/components/ui';
import { farmOverviewDict } from '@/constants/farmOverview.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useFarmOverview, useHouseComparison } from '@/hooks/farm-owner/useFarmOverview';
import { useScopeFilter } from '@/hooks/farm-owner/useScopeFilter';
import { cn } from '@/lib/cn';
import type { ComparisonSortKey, HouseOverview } from '@/types';

// Tên tab trùng khoá tab.*; tab đầu là mặc định
const TABS = ['houses', 'comparison'] as const;
type OverviewTab = (typeof TABS)[number];
// Khoảng so sánh; mặc định 30 ngày như backend (Report 3 §4.5) đứng đầu: SelectMenu coi lựa chọn đầu là mặc định
const PERIOD_DAYS = [30, 7, 90] as const;
type PeriodDays = (typeof PERIOD_DAYS)[number];
const DEFAULT_PERIOD: PeriodDays = 30;
const DAY_MS = 86_400_000;
// Thứ tự trong ô "Sắp theo": tên nhà rồi 9 chỉ số BR-44 theo thứ tự nhóm cột
const SORT_KEYS: ComparisonSortKey[] = [
  'name', 'time_in_range_pct', 'good_days_pct', 'return_rate_avg', 'flock_trend_pct',
  'alerts_raised', 'alerts_open', 'mttr_min', 'energy_kwh', 'last_cycle_yield_g',
];

// Khung viền đứt khi rỗng
function EmptyFrame({ title, hint }: { title: string; hint: string }): JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-warmGray/30 px-6 pb-10 pt-20">
      <TableEmptyState title={title} description={hint} />
    </div>
  );
}

// ANALYTICS-FR-015, 016 — Tổng quan trại: tình hình hôm nay của từng nhà và bảng so sánh nhà; Farm Owner xem, Domain Expert đọc
export default function FarmOwnerOverviewPage(): JSX.Element {
  const { t, date } = useTranslation(farmOverviewDict);
  const apiErrorMessage = useApiErrorMessage();
  const scope = useScopeFilter();
  const navigate = useNavigate();
  // Trang tính trong 1 trang trại: chưa chọn mà chỉ có 1 trang trại thì dùng luôn trang trại đó
  const farmId = scope.farmId || (scope.farms.length === 1 ? scope.farms[0]._id : '');
  const farmName = scope.farms.find(farm => farm._id === farmId)?.name ?? '';

  // Tab nằm trên URL (?tab=comparison) để F5 hoặc quay lại vẫn đúng tab
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: OverviewTab = TABS.find(value => value === searchParams.get('tab')) ?? 'houses';
  const setTab = (value: OverviewTab) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (value === 'houses') next.delete('tab');
    else next.set('tab', value);
    return next;
  }, { replace: true });

  const [periodDays, setPeriodDays] = useState<PeriodDays>(DEFAULT_PERIOD);
  const [sort, setSort] = useState<ComparisonSortKey>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  // Khoảng [from, to) tính 1 lần mỗi khi đổi số ngày, để khoá truy vấn không đổi theo từng lần vẽ lại
  const period = useMemo(() => {
    const to = new Date();
    to.setSeconds(0, 0);
    return { from: new Date(to.getTime() - periodDays * DAY_MS).toISOString(), to: to.toISOString() };
  }, [periodDays]);

  // Mỗi tab chỉ tải dữ liệu của mình; hàng so sánh tự mang nhãn "Giả lập"
  const overview = useFarmOverview(tab === 'houses' && farmId ? farmId : undefined);
  const comparison = useHouseComparison(tab === 'comparison' && farmId ? farmId : undefined, { ...period, sort, order });

  // Lọc đúng trại và nhà ở khung lọc chung rồi mở trang Phân tích (không đưa mã nhà lên URL)
  const openAnalytics = (house: HouseOverview) => {
    if (scope.farmId !== farmId) scope.setFarmId(farmId);
    scope.setHouseId(house.house_id);
    navigate('/analytics');
  };

  // Chưa có farm: đang tải thì khung chờ, tải lỗi thì báo kèm Thử lại, xong mới báo chưa có farm (FE_Design 13.5)
  if (scope.farms.length === 0 && scope.isLoading) return <LoadingSkeleton count={5} className="h-14 w-full" />;
  if (scope.farms.length === 0 && scope.isError) {
    return (
      <EmptyState
        title={t('page.loadFailed')}
        description={apiErrorMessage(undefined)}
        action={<Button variant="secondary" size="sm" onClick={scope.refetch}>{t('page.retry')}</Button>}
      />
    );
  }
  if (scope.farms.length === 0) {
    return (
      <EmptyState
        title={t('page.noFarmTitle')}
        description={t('page.noFarmDesc')}
        action={<Link to="/farms"><Button>{t('page.goFarms')}</Button></Link>}
      />
    );
  }

  // Thân tab Các nhà
  let housesBody = <LoadingSkeleton count={3} className="h-40 w-full" />;
  if (overview.isError) {
    housesBody = (
      <EmptyState
        title={t('houses.errorTitle')}
        description={apiErrorMessage(overview.error)}
        action={<Button variant="secondary" size="sm" onClick={() => void overview.refetch()}>{t('page.retry')}</Button>}
      />
    );
  } else if (overview.data && overview.data.houses.length === 0) {
    housesBody = <EmptyFrame title={t('houses.emptyTitle')} hint={t('houses.emptyHint')} />;
  } else if (overview.data) {
    housesBody = (
      <>
        <FarmOverviewSummary houses={overview.data.houses} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {overview.data.houses.map(house => (
            <HouseOverviewCard key={house.house_id} house={house} onOpenAnalytics={openAnalytics} />
          ))}
        </div>
      </>
    );
  }

  // Thân tab So sánh nhà
  let comparisonBody = <LoadingSkeleton count={5} className="h-14 w-full" />;
  if (comparison.isError) {
    comparisonBody = (
      <EmptyState
        title={t('comparison.errorTitle')}
        description={apiErrorMessage(comparison.error)}
        action={<Button variant="secondary" size="sm" onClick={() => void comparison.refetch()}>{t('page.retry')}</Button>}
      />
    );
  } else if (comparison.data && comparison.data.rows.length === 0) {
    comparisonBody = <EmptyFrame title={t('comparison.emptyTitle')} hint={t('comparison.emptyHint')} />;
  } else if (comparison.data) {
    // Backend trả to là mốc không gồm: ngày cuối của khoảng là ngày trước mốc đó
    const lastDay = new Date(Date.parse(comparison.data.to) - 1).toISOString();
    comparisonBody = (
      <>
        <p className="text-sm text-warmGray">
          {t('comparison.range', { from: date(comparison.data.from), to: date(lastDay) })}
        </p>
        <HouseComparisonTable rows={comparison.data.rows} sort={sort} />
        <p className="text-xs text-warmGray">{t('comparison.note')}</p>
      </>
    );
  }

  // Số lựa chọn khác mặc định (30 ngày, tên nhà, tăng dần) — hiện trên nút Hủy lọc
  const changedCount = Number(periodDays !== DEFAULT_PERIOD) + Number(sort !== 'name') + Number(order !== 'asc');
  const resetComparison = () => {
    setPeriodDays(DEFAULT_PERIOD);
    setSort('name');
    setOrder('asc');
  };

  // Hàng điều khiển của tab So sánh: Hủy lọc bên trái, khoảng, chỉ số sắp, chiều sắp — cùng cao h-9 (FE_Design 1.1, Lọc + tìm)
  const comparisonToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      {changedCount > 0 && <ClearFiltersButton tone="danger" count={changedCount} className="h-9" onClick={resetComparison} />}
      <SelectMenu
        ariaLabel={t('comparison.periodLabel')}
        value={String(periodDays)}
        onChange={value => setPeriodDays(Number(value) as PeriodDays)}
        options={PERIOD_DAYS.map(value => ({
          value: String(value),
          label: t('comparison.period', { n: value }),
        }))}
      />
      <SelectMenu
        ariaLabel={t('sort.label')}
        value={sort}
        onChange={setSort}
        options={SORT_KEYS.map(key => ({ value: key, label: t(`col.${key}`) }))}
      />
      {/* Nút đảo chiều cùng cỡ ô SelectMenu */}
      <Button
        variant="secondary"
        size="sm"
        className="h-9 px-3.5 text-xs font-medium"
        onClick={() => setOrder(previous => (previous === 'asc' ? 'desc' : 'asc'))}
      >
        {order === 'asc' ? <SortAscendingIcon size={14} weight="bold" aria-hidden /> : <SortDescendingIcon size={14} weight="bold" aria-hidden />}
        {t(`sort.${order}`)}
      </Button>
    </div>
  );

  // Tab pill như trang Sức khỏe nhà yến, đặt bên phải dòng tiêu đề của khung
  const tabSwitcher = (
    <div className="inline-flex shrink-0 gap-1 rounded-full bg-warmGray/10 p-1" role="tablist" aria-label={t('page.tabs')}>
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
  );

  // Thân trang: chưa chọn trại thì nhắc chọn, còn lại là khung của tab đang mở
  let content = <EmptyState title={t('page.pickFarmTitle')} description={t('page.pickFarmHint')} />;
  if (farmId && tab === 'houses') {
    content = (
      <SectionCard
        className="flex-1"
        title={t('houses.title', { farm: farmName })}
        description={overview.data ? t('houses.subtitle', { date: date(overview.data.date) }) : undefined}
        action={tabSwitcher}
      >
        {housesBody}
      </SectionCard>
    );
  } else if (farmId) {
    content = (
      <SectionCard title={t('comparison.title')} description={t('comparison.subtitle')} action={tabSwitcher}>
        {comparisonToolbar}
        {comparisonBody}
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <HeaderActions>
        <div className="hidden sm:block">
          <ScopeFilter scope={scope} lockHouse />
        </div>
      </HeaderActions>
      <div className="sm:hidden">
        <ScopeFilter scope={scope} lockHouse />
      </div>

      {content}
    </div>
  );
}
