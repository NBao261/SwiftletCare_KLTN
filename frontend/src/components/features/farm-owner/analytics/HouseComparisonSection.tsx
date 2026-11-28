import { useMemo, useState } from 'react';

import HouseComparisonTable from '@/components/features/farm-owner/overview/HouseComparisonTable';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import SegmentedChips from '@/components/features/farm-owner/analytics/SegmentedChips';
import TableEmptyState from '@/components/common/TableEmptyState';
import { EmptyState, LoadingSkeleton } from '@/components/ui';
import { farmOverviewDict } from '@/constants/farmOverview.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHouseComparison } from '@/hooks/farm-owner/useFarmOverview';
import type { ComparisonSortKey } from '@/types';
import LoadError from '@/components/ui/LoadError'

// Khoảng so sánh; mặc định 30 ngày như backend
const PERIOD_DAYS = [7, 30, 90] as const;
type PeriodDays = (typeof PERIOD_DAYS)[number];
const DEFAULT_PERIOD: PeriodDays = 30;
const DAY_MS = 86_400_000;

// So sánh các nhà của 1 trang trại trong 1 kỳ (nhóm thứ tư của Phân tích); farmId rỗng thì nhắc chọn trang trại
export default function HouseComparisonSection({ farmId }: { farmId: string }): JSX.Element {
  const { t, date } = useTranslation(farmOverviewDict);
  const [periodDays, setPeriodDays] = useState<PeriodDays>(DEFAULT_PERIOD);
  const [sort, setSort] = useState<ComparisonSortKey>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  // Khoảng [from, to) tính 1 lần mỗi khi đổi số ngày, để khoá truy vấn không đổi theo từng lần vẽ lại
  const period = useMemo(() => {
    const to = new Date();
    to.setSeconds(0, 0);
    return { from: new Date(to.getTime() - periodDays * DAY_MS).toISOString(), to: to.toISOString() };
  }, [periodDays]);
  const comparison = useHouseComparison(farmId || undefined, { ...period, sort, order });

  // Bấm lại cột đang sắp thì đảo chiều; cột mới: tên tăng dần, số liệu giảm dần
  function handleSort(key: ComparisonSortKey): void {
    if (key === sort) {
      setOrder(previous => (previous === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSort(key);
    setOrder(key === 'name' ? 'asc' : 'desc');
  }

  if (!farmId) {
    return <EmptyState title={t('page.pickFarmTitle')} description={t('page.pickFarmHint')} />;
  }

  let body = <LoadingSkeleton count={4} className="h-16 w-full" />;
  if (comparison.isError) {
    body = (
      <LoadError title={t('comparison.errorTitle')} error={comparison.error} onRetry={() => void comparison.refetch()} />
    );
  } else if (comparison.data && comparison.data.rows.length === 0) {
    body = (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-warmGray/30 px-6 py-12">
        <TableEmptyState title={t('comparison.emptyTitle')} description={t('comparison.emptyHint')} />
      </div>
    );
  } else if (comparison.data) {
    // Backend trả to là mốc không gồm: ngày cuối của khoảng là ngày trước mốc đó
    const lastDay = new Date(Date.parse(comparison.data.to) - 1).toISOString();
    body = (
      <>
        <HouseComparisonTable rows={comparison.data.rows} sort={sort} order={order} onSort={handleSort} />
        <p className="text-small text-warmGray">
          {t('comparison.range', { from: date(comparison.data.from), to: date(lastDay) })} · {t('comparison.note')}
        </p>
      </>
    );
  }

  return (
    <FarmFrame
      title={t('comparison.title')}
      description={t('comparison.subtitle')}
      action={(
        <SegmentedChips
          options={PERIOD_DAYS.map(value => ({ value, label: t('comparison.period', { n: value }) }))}
          value={periodDays}
          onChange={setPeriodDays}
          ariaLabel={t('comparison.periodLabel')}
        />
      )}
    >
      {body}
    </FarmFrame>
  );
}
