import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { format, parseISO } from 'date-fns';
import { ArrowLineDownIcon, ArrowLineUpIcon, ChartLineIcon } from '@phosphor-icons/react';

import { Button, ChartEmptyFrame, EmptyState, LoadingSkeleton } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import KpiTile from '@/components/features/farm-owner/farms/KpiTile';
import { CHART_LEGEND, X_AXIS_TICKS } from '@/components/features/farm-owner/analytics/analytics.constants';
import { groupBucketsByHour } from '@/components/features/farm-owner/analytics/analyticsMetrics';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHousesBirdCountBuckets, useHousesBirdCountCurrent } from '@/hooks/farm-owner/useAnalytics';
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme';

interface BirdHourlyCardProps {
  // 1 nhà, hoặc mọi nhà của farm khi lọc tất cả nhà yến (số đếm cộng lại)
  houseIds: string[];
  scopeLabel: string;
}

// Chim ra, vào theo giờ trong 24 giờ qua (VISION-FR-017) và số đếm hôm nay (VISION-FR-012) của các nhà yến đang lọc
export default function BirdHourlyCard({ houseIds, scopeLabel }: BirdHourlyCardProps): JSX.Element {
  const { t, num, ago } = useTranslation(analyticsDict);
  const buckets = useHousesBirdCountBuckets(houseIds);
  const current = useHousesBirdCountCurrent(houseIds);
  const today = current.today;

  const hourlyCounts = useMemo(() => groupBucketsByHour(buckets.buckets), [buckets.buckets]);

  const chartData = useMemo(() => ({
    labels: hourlyCounts.map(hour => format(parseISO(hour.hourStart), 'HH:mm')),
    datasets: [
      { label: t('chart.exit'), data: hourlyCounts.map(hour => hour.exitCount), backgroundColor: CHART_COLORS.gray300, borderRadius: 6, maxBarThickness: 18 },
      { label: t('chart.entry'), data: hourlyCounts.map(hour => hour.entryCount), backgroundColor: CHART_COLORS.accentGreen, borderRadius: 6, maxBarThickness: 18 },
    ],
  }), [hourlyCounts, t]);

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, legend: CHART_LEGEND },
    scales: {
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...X_AXIS_TICKS } },
      y: { ...baseChartOptions.scales.y, min: 0 },
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiTile
          icon={ArrowLineUpIcon}
          label={t('hourly.exitToday')}
          value={countText(today.morningExit + today.eveningExit)}
          sub={today.updatedAt ? t('hourly.sessions', { morning: num(today.morningExit), evening: num(today.eveningExit) }) : todaySub}
        />
        <KpiTile
          icon={ArrowLineDownIcon}
          label={t('hourly.entryToday')}
          value={countText(today.morningEntry + today.eveningEntry)}
          sub={today.updatedAt ? t('hourly.sessions', { morning: num(today.morningEntry), evening: num(today.eveningEntry) }) : todaySub}
        />
        <KpiTile
          icon={ChartLineIcon}
          label={t('hourly.returnToday')}
          value={today.returnRate === null ? NO_VALUE : num(today.returnRate, 1)}
          unit={today.returnRate === null ? undefined : '%'}
          sub={today.returnRate === null && today.updatedAt ? t('hourly.returnPending') : todaySub}
        />
      </div>
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
