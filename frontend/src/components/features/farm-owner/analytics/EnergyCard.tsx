import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { ChartEmptyFrame, LoadingSkeleton } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import StatStrip from '@/components/common/StatStrip';
import { BAR_MARK, CHART_FONT, CHART_LEGEND, SERIES_COLORS, axisTitle } from '@/components/features/farm-owner/analytics/analytics.constants';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHouseEnergy } from '@/hooks/farm-owner/useAnalytics';
import { baseChartOptions } from '@/lib/chartTheme';
import LoadError from '@/components/ui/LoadError'

// "2026-10" → "10/2026"
const monthLabel = (month: string) => month.split('-').reverse().join('/');

// điện năng ước tính của bơm và quạt theo tháng; tải không có dòng đo ghi "không đo được"
export default function EnergyCard({ houseId, houseName }: { houseId: string; houseName: string }): JSX.Element {
  const { t, num, exact } = useTranslation(analyticsDict);
  const { data, isLoading, isError, error, refetch } = useHouseEnergy(houseId);
  const months = useMemo(() => data?.months ?? [], [data]);

  const chartData = useMemo(() => ({
    labels: months.map(item => monthLabel(item.month)),
    datasets: [
      { label: t('energy.misting'), data: months.map(item => item.misting_kwh), backgroundColor: SERIES_COLORS.own, ...BAR_MARK },
      { label: t('energy.ventilation'), data: months.map(item => item.ventilation_kwh), backgroundColor: SERIES_COLORS.secondary, ...BAR_MARK },
    ],
  }), [months, t]);

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, legend: { ...CHART_LEGEND, labels: { ...CHART_LEGEND.labels, font: CHART_FONT } } },
    scales: {
      x: baseChartOptions.scales.x,
      y: { ...baseChartOptions.scales.y, min: 0, title: axisTitle(t('energy.chartAxis')) },
    },
  } as ChartOptions<'bar'>), [t]);

  // Số kWh 3 chữ số lẻ như backend (tải DC 5 V, 12 V rất nhỏ), hoặc "_" kèm dòng phụ "không đo được dòng điện"
  const tile = (value: number | null | undefined) => ({
    value: value == null ? NO_VALUE : exact(value, 3),
    unit: value == null ? undefined : 'kWh',
    sub: value == null ? t('energy.notAvailable') : t('energy.kwhSub'),
  });

  let body = <LoadingSkeleton className="h-72 w-full" />;
  if (!isLoading && isError) {
    body = (
      <LoadError title={t('common.loadError')} error={error} onRetry={() => void refetch()} />
    );
  }
  if (!isLoading && !isError && data) {
    body = (
      <>
        <StatStrip
          items={[
            { label: t('energy.misting'), ...tile(data.total.misting_kwh) },
            { label: t('energy.ventilation'), ...tile(data.total.ventilation_kwh) },
            { label: t('energy.total'), ...tile(data.total.total_kwh) },
          ]}
        />
        {data.total.total_kwh !== null ? (
          <div className="h-64">
            <Bar data={chartData} options={chartOptions} />
          </div>
        ) : (
          <ChartEmptyFrame message={t('energy.empty')} className="h-64" />
        )}
        <p className="text-xs text-warmGray">
          {t('energy.voltage', { misting: num(data.supply_voltage.misting), ventilation: num(data.supply_voltage.ventilation) })}
        </p>
      </>
    );
  }

  return (
    <FarmFrame
      title={t('energy.title')}
      description={t('energy.subtitle', { house: houseName })}
      className="h-full"
    >
      {body}
    </FarmFrame>
  );
}
