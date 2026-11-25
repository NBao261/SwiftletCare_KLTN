import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { Button, ChartEmptyFrame, EmptyState, LoadingSkeleton } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import StatStrip from '@/components/features/farm-owner/analytics/StatStrip';
import { BAR_MARK, SERIES_COLORS, X_AXIS_TICKS } from '@/components/features/farm-owner/analytics/analytics.constants';
import SegmentedChips from '@/components/features/farm-owner/analytics/SegmentedChips';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHousesBirdCountTrends } from '@/hooks/farm-owner/useAnalytics';
import { baseChartOptions } from '@/lib/chartTheme';
import type { FlockPeriod } from '@/types';

type Granularity = 'weekly' | 'monthly';
// 90 ngày để đủ vài tháng trọn (api-spec flock_trend)
const TREND_DAYS = 90;
const NO_PERIODS: FlockPeriod[] = [];

// "2026-10" → "10/2026"; tuần "2026-11-09" → "09/11"
function periodLabel(period: string, granularity: Granularity): string {
  const [year, month, day] = period.split('-');
  return granularity === 'monthly' ? `${month}/${year}` : `${day}/${month}`;
}

// số chim ra buổi sáng trung bình theo tuần hoặc tháng của 1 nhà, kèm % đổi so với kỳ trước
export default function FlockTrendCard({ houseId, houseName }: { houseId: string; houseName: string }): JSX.Element {
  const { t, num, date } = useTranslation(analyticsDict);
  const [granularity, setGranularity] = useState<Granularity>('weekly');
  const { single, isLoading, isError, refetch } = useHousesBirdCountTrends([houseId], TREND_DAYS);
  const periods = single?.flock_trend?.[granularity] ?? NO_PERIODS;
  const latest = periods[periods.length - 1];

  const chartData = useMemo(() => ({
    labels: periods.map(item => periodLabel(item.period, granularity)),
    datasets: [{
      label: t('flock.chartLabel'),
      data: periods.map(item => Math.round(item.mean_morning_exit)),
      backgroundColor: SERIES_COLORS.exit,
      ...BAR_MARK,
    }],
  }), [periods, granularity, t]);

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    scales: {
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...X_AXIS_TICKS } },
      y: { ...baseChartOptions.scales.y, min: 0 },
    },
  } as ChartOptions<'bar'>), []);

  let body = <LoadingSkeleton className="h-72 w-full" />;
  if (!isLoading && isError) {
    body = (
      <EmptyState
        title={t('common.loadError')}
        action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('common.retry')}</Button>}
      />
    );
  }
  if (!isLoading && !isError) {
    let latestSub = NO_VALUE;
    if (latest && granularity === 'weekly') latestSub = t('flock.latestWeekSub', { date: date(latest.period), n: num(latest.days) });
    if (latest && granularity === 'monthly') latestSub = t('flock.latestMonthSub', { month: periodLabel(latest.period, 'monthly'), n: num(latest.days) });
    const change = latest?.change_pct ?? null;
    let changeText = NO_VALUE;
    if (change !== null) changeText = `${change > 0 ? '+' : ''}${num(change, 1)}`;
    body = (
      <>
        <StatStrip
          items={[
            { label: t('flock.latest'), value: latest ? num(latest.mean_morning_exit) : NO_VALUE, sub: latestSub },
            { label: t('flock.change'), value: changeText, unit: change === null ? undefined : '%', sub: t('flock.changeSub') },
          ]}
        />
        {periods.length > 0 ? (
          <div className="h-64">
            <Bar data={chartData} options={chartOptions} />
          </div>
        ) : (
          <ChartEmptyFrame message={t('flock.empty')} className="h-64" />
        )}
      </>
    );
  }

  return (
    <FarmFrame
      title={t('flock.title')}
      description={t('flock.subtitle', { house: houseName })}
      action={(
        <SegmentedChips
          options={[{ value: 'weekly', label: t('flock.weekly') }, { value: 'monthly', label: t('flock.monthly') }]}
          value={granularity}
          onChange={setGranularity}
          ariaLabel={t('flock.title')}
        />
      )}
      className="h-full"
    >
      {body}
    </FarmFrame>
  );
}
