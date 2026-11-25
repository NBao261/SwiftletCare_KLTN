import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { format, parseISO } from 'date-fns';
import { Button, ChartEmptyFrame, EmptyState, LoadingSkeleton } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import StatStrip from '@/components/features/farm-owner/analytics/StatStrip';
import { BAR_MARK, CHART_FONT, CHART_LEGEND, SERIES_COLORS, X_AXIS_TICKS } from '@/components/features/farm-owner/analytics/analytics.constants';
import { groupBucketsByHour } from '@/components/features/farm-owner/analytics/analyticsMetrics';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHousesBirdCountBuckets, useHousesBirdCountCurrent } from '@/hooks/farm-owner/useAnalytics';
import { baseChartOptions } from '@/lib/chartTheme';

interface BirdHourlyCardProps {
  // 1 nhà, hoặc mọi nhà của farm khi lọc tất cả nhà yến (số đếm cộng lại)
  houseIds: string[];
  scopeLabel: string;
}

// Chim ra, vào theo giờ trong 24 giờ qua và số đếm hôm nay của các nhà yến đang lọc
export default function BirdHourlyCard({ houseIds, scopeLabel }: BirdHourlyCardProps): JSX.Element {
  const { t, num, ago } = useTranslation(analyticsDict);
  const buckets = useHousesBirdCountBuckets(houseIds);
  const current = useHousesBirdCountCurrent(houseIds);
  const today = current.today;

  const hourlyCounts = useMemo(() => groupBucketsByHour(buckets.buckets), [buckets.buckets]);

  const chartData = useMemo(() => ({
    labels: hourlyCounts.map(hour => format(parseISO(hour.hourStart), 'HH:mm')),
    datasets: [
      { label: t('chart.exit'), data: hourlyCounts.map(hour => hour.exitCount), backgroundColor: SERIES_COLORS.exit, ...BAR_MARK },
      { label: t('chart.entry'), data: hourlyCounts.map(hour => hour.entryCount), backgroundColor: SERIES_COLORS.entry, ...BAR_MARK },
    ],
  }), [hourlyCounts, t]);

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, legend: { ...CHART_LEGEND, labels: { ...CHART_LEGEND.labels, font: CHART_FONT } } },
    scales: {
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...X_AXIS_TICKS } },
      // Số chim là số nguyên, không âm: trục bắt đầu ở 0
      y: { ...baseChartOptions.scales.y, min: 0, ticks: { ...baseChartOptions.scales.y.ticks, precision: 0 } },
    },
  } as ChartOptions<'bar'>), []);

  // Dòng phụ của ô hôm nay: mốc cập nhật hoặc báo chưa có số đếm
  const todaySub = today?.updatedAt ? t('hourly.updated', { ago: ago(today.updatedAt) }) : t('hourly.noToday');

  // Hôm nay chưa có tin đếm nào thì các ô hiện "_" thay cho số 0
  const hasToday = Boolean(today?.updatedAt);
  const countText = (value: number): string => (hasToday ? num(value) : NO_VALUE);

  // 3 ô số đếm hôm nay
  let todayTiles: JSX.Element | null = <LoadingSkeleton count={1} className="h-24 w-full" />;
  if (!current.isLoading && today) {
    todayTiles = (
      <StatStrip
        items={[
          { label: t('hourly.exitToday'), value: countText(today.morningExit), sub: todaySub },
          { label: t('hourly.entryToday'), value: countText(today.eveningEntry), sub: todaySub },
          {
            label: t('hourly.returnToday'),
            value: today.returnRate === null ? NO_VALUE : num(today.returnRate, 1),
            unit: today.returnRate === null ? undefined : '%',
            sub: today.returnRate === null && today.updatedAt ? t('hourly.returnPending') : todaySub,
          },
        ]}
      />
    );
  }
  if (!current.isLoading && current.isError) todayTiles = null;

  // Biểu đồ theo trạng thái tải, lỗi, chưa có số đếm
  let chart = <LoadingSkeleton className="h-64 w-full" />;
  if (!buckets.isLoading && hourlyCounts.length === 0) chart = <ChartEmptyFrame message={t('hourly.empty')} className="h-64" />;
  if (!buckets.isLoading && hourlyCounts.length > 0) {
    chart = (
      <div className="h-64">
        <Bar data={chartData} options={chartOptions} />
      </div>
    );
  }
  if (!buckets.isLoading && (buckets.isError || current.isError)) {
    chart = (
      <EmptyState
        title={t('common.loadError')}
        action={(
          <Button variant="secondary" size="sm" onClick={() => { void buckets.refetch(); void current.refetch(); }}>
            {t('common.retry')}
          </Button>
        )}
      />
    );
  }

  return (
    <FarmFrame title={t('hourly.title')} description={t('hourly.subtitle', { house: scopeLabel })}>
      {todayTiles}
      {chart}
    </FarmFrame>
  );
}
