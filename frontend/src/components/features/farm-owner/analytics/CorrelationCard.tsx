import { useMemo, useState } from 'react';
import { Scatter } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';

import { Badge, Button, ChartEmptyFrame, EmptyState, FilterChip, LoadingSkeleton } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import SegmentedChips from '@/components/features/farm-owner/analytics/SegmentedChips';
import {
  CORRELATION_DAY_OPTIONS,
  axisTitle,
  type CorrelationDayOption,
} from '@/components/features/farm-owner/analytics/analytics.constants';
import { correlationStrength, pearsonCorrelation } from '@/components/features/farm-owner/analytics/analyticsMetrics';
import { analyticsDict } from '@/constants/analytics.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useCorrelation } from '@/hooks/farm-owner/useAnalytics';
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme';

// Chỉ số môi trường đem so với tỷ lệ chim về
const CORRELATION_METRICS = ['humidity', 'temperature'] as const;
type CorrelationMetric = typeof CORRELATION_METRICS[number];

interface CorrelationCardProps {
  zoneId: string;
}

// Tương quan độ ẩm hoặc nhiệt độ trung bình ngày với tỷ lệ chim về cùng ngày (ANALYTICS-FR-003)
export default function CorrelationCard({ zoneId }: CorrelationCardProps): JSX.Element {
  const { t, num } = useTranslation(analyticsDict);
  const [days, setDays] = useState<CorrelationDayOption>(30);
  const [metric, setMetric] = useState<CorrelationMetric>('humidity');
  const { data, isLoading, isError, refetch } = useCorrelation(zoneId, days);

  const dayOptions = CORRELATION_DAY_OPTIONS.map(value => ({ value, label: t('common.days', { n: value }) }));
  const metricUnit = metric === 'humidity' ? '%' : '°C';

  // Chỉ giữ ngày có cả số đo môi trường và tỷ lệ chim về
  const points = useMemo(() => {
    const result: Array<{ x: number; y: number }> = [];
    for (const point of data?.points ?? []) {
      if (point.return_rate === null) continue;
      const environmentValue = metric === 'humidity' ? point.avg_humidity : point.avg_temperature;
      result.push({ x: environmentValue, y: point.return_rate });
    }
    return result;
  }, [data, metric]);

  const coefficient = useMemo(
    () => pearsonCorrelation(points.map(point => point.x), points.map(point => point.y)),
    [points],
  );

  const chartData = useMemo(() => ({
    datasets: [{ label: t('chart.returnRate'), data: points, backgroundColor: CHART_COLORS.charcoal, pointRadius: 4 }],
  }), [points, t]);

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    scales: {
      x: { ...baseChartOptions.scales.x, title: axisTitle(`${t(`metric.${metric}`)} (${metricUnit})`) },
      y: { ...baseChartOptions.scales.y, title: axisTitle(t('chart.returnRate')) },
    },
  } as ChartOptions<'scatter'>), [metric, metricUnit, t]);

  // Nhãn mức tương quan kèm chiều thuận hoặc nghịch
  let strengthLabel = '';
  if (coefficient !== null) {
    const strength = correlationStrength(coefficient);
    strengthLabel = t(`correlation.strength.${strength}`);
    if (strength !== 'none') {
      strengthLabel = `${strengthLabel} ${coefficient >= 0 ? t('correlation.positive') : t('correlation.negative')}`;
    }
  }

  // Thân khung theo trạng thái tải, lỗi, chưa đủ dữ liệu
  let body = <LoadingSkeleton className="h-64 w-full" />;
  if (!isLoading && isError) {
    body = (
      <EmptyState
        title={t('common.loadError')}
        action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('common.retry')}</Button>}
      />
    );
  }
  if (!isLoading && !isError && points.length < 2) {
    body = <ChartEmptyFrame message={t('correlation.emptyDesc')} className="h-64" />;
  }
  if (!isLoading && !isError && points.length >= 2) {
    body = (
      <>
        {coefficient !== null && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-charcoal">
              {t('correlation.coefficient', { value: `${coefficient >= 0 ? '+' : ''}${num(coefficient, 2)}` })}
            </p>
            <Badge tone="neutral">{strengthLabel}</Badge>
          </div>
        )}
        <div className="h-64">
          <Scatter data={chartData} options={chartOptions} />
        </div>
        <p className="text-small text-warmGray">{t('correlation.sample', { n: num(points.length), days })}</p>
      </>
    );
  }

  return (
    <FarmFrame
      title={t('correlation.title')}
      description={t('correlation.subtitle')}
      action={<SegmentedChips options={dayOptions} value={days} onChange={setDays} ariaLabel={t('correlation.title')} />}
      className="h-full"
    >
      {/* Chọn chỉ số môi trường */}
      <div className="flex flex-wrap gap-2">
        {CORRELATION_METRICS.map(option => (
          <FilterChip key={option} active={metric === option} label={t(`metric.${option}`)} onClick={() => setMetric(option)} />
        ))}
      </div>
      {body}
    </FarmFrame>
  );
}
