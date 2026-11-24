import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SortAscendingIcon, SortDescendingIcon } from '@phosphor-icons/react';

import ScopeFilter from '@/components/common/ScopeFilter';
import TableEmptyState from '@/components/common/TableEmptyState';
import HouseComparisonTable from '@/components/features/farm-owner/overview/HouseComparisonTable';
import HeaderActions from '@/components/layouts/HeaderActions';
import { Button, ClearFiltersButton, EmptyState, LoadingSkeleton, SectionCard, SelectMenu } from '@/components/ui';
import { farmOverviewDict } from '@/constants/farmOverview.i18n';
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHouseComparison } from '@/hooks/farm-owner/useFarmOverview';
import { useScopeFilter } from '@/hooks/shared/useScopeFilter';
import type { ComparisonSortKey } from '@/types';

// Khoảng so sánh; mặc định 30 ngày như backend đứng đầu: SelectMenu coi lựa chọn đầu là mặc định
const PERIOD_DAYS = [30, 7, 90] as const;
type PeriodDays = (typeof PERIOD_DAYS)[number];
const DEFAULT_PERIOD: PeriodDays = 30;
const DAY_MS = 86_400_000;
// Thứ tự trong ô "Sắp theo": tên nhà rồi 9 chỉ số theo thứ tự nhóm cột
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

// Tab So sánh nhà
export default function FarmOwnerOverviewPage(): JSX.Element {
  const { t, date } = useTranslation(farmOverviewDict);
  const apiErrorMessage = useApiErrorMessage();
  const scope = useScopeFilter();
  // Trang tính trong 1 trang trại: chưa chọn mà chỉ có 1 trang trại thì dùng luôn trang trại đó
  const farmId = scope.farmId || (scope.farms.length === 1 ? scope.farms[0]._id : '');

  const [periodDays, setPeriodDays] = useState<PeriodDays>(DEFAULT_PERIOD);
  const [sort, setSort] = useState<ComparisonSortKey>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  // Khoảng [from, to) tính 1 lần mỗi khi đổi số ngày, để khoá truy vấn không đổi theo từng lần vẽ lại
  const period = useMemo(() => {
    const to = new Date();
    to.setSeconds(0, 0);
    return { from: new Date(to.getTime() - periodDays * DAY_MS).toISOString(), to: to.toISOString() };
  }, [periodDays]);

  // Hàng so sánh tự mang nhãn "Giả lập"
  const comparison = useHouseComparison(farmId || undefined, { ...period, sort, order });

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

  // Bảng so sánh
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
        <p className="text-body text-graphite">
          {t('comparison.range', { from: date(comparison.data.from), to: date(lastDay) })}
        </p>
        <HouseComparisonTable rows={comparison.data.rows} sort={sort} />
        <p className="text-small text-warmGray">{t('comparison.note')}</p>
      </>
    );
  }

  // Số lựa chọn khác mặc định (30 ngày, tên nhà, tăng dần): hiện trên nút Hủy lọc
  const changedCount = Number(periodDays !== DEFAULT_PERIOD) + Number(sort !== 'name') + Number(order !== 'asc');
  const resetComparison = () => {
    setPeriodDays(DEFAULT_PERIOD);
    setSort('name');
    setOrder('asc');
  };

  // Hàng điều khiển cùng cao h-9
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
        className="px-3.5 text-small font-medium"
        onClick={() => setOrder(previous => (previous === 'asc' ? 'desc' : 'asc'))}
      >
        {order === 'asc' ? <SortAscendingIcon size={14} weight="bold" aria-hidden /> : <SortDescendingIcon size={14} weight="bold" aria-hidden />}
        {t(`sort.${order}`)}
      </Button>
    </div>
  );

  // Thân trang: chưa có trang trại nào được chọn (đang tự chọn) thì nhắc chọn; 1 card nên không lặp tên trang
  let content = <EmptyState title={t('page.pickFarmTitle')} description={t('page.pickFarmHint')} />;
  if (farmId) {
    content = (
      <SectionCard description={t('comparison.subtitle')} action={comparisonToolbar}>
        {comparisonBody}
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <HeaderActions>
        <ScopeFilter scope={scope} lockHouse />
      </HeaderActions>

      {content}
    </div>
  );
}
