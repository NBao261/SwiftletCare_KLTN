import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { DropIcon, FanIcon, LightningIcon } from '@phosphor-icons/react';

import { Button, ChartEmptyFrame, EmptyState, LoadingSkeleton } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import KpiTile from '@/components/common/KpiTile';
import { CHART_LEGEND, axisTitle } from '@/components/features/farm-owner/analytics/analytics.constants';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHouseEnergy } from '@/hooks/farm-owner/useAnalytics';
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme';

// "2026-10" → "10/2026"
const monthLabel = (month: string) => month.split('-').reverse().join('/');

// ANALYTICS-FR-017, BR-45 — điện năng ước tính của bơm và quạt theo tháng; tải không có dòng đo ghi "không đo được"
export default function EnergyCard({ houseId, houseName }: { houseId: string; houseName: string }): JSX.Element {
  const { t, num, exact } = useTranslation(analyticsDict);
  const { data, isLoading, isError, refetch } = useHouseEnergy(houseId);
  const months = useMemo(() => data?.months ?? [], [data]);

  const chartData = useMemo(() => ({
    labels: months.map(item => monthLabel(item.month)),
    datasets: [
      { label: t('energy.misting'), data: months.map(item => item.misting_kwh), backgroundColor: CHART_COLORS.accentGreen, borderRadius: 6, maxBarThickness: 24 },
      { label: t('energy.ventilation'), data: months.map(item => item.ventilation_kwh), backgroundColor: CHART_COLORS.graphite, borderRadius: 6, maxBarThickness: 24 },
    ],
  }), [months, t]);

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, legend: CHART_LEGEND },
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
      <EmptyState
        title={t('common.loadError')}
        action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('common.retry')}</Button>}
      />
    );
  }
  if (!isLoading && !isError && data) {
    body = (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiTile icon={DropIcon} label={t('energy.misting')} {...tile(data.total.misting_kwh)} />
          <KpiTile icon={FanIcon} label={t('energy.ventilation')} {...tile(data.total.ventilation_kwh)} />
          <KpiTile icon={LightningIcon} label={t('energy.total')} {...tile(data.total.total_kwh)} />
        </div>
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
