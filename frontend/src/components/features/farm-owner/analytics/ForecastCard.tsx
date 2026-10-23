import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { format, parseISO } from 'date-fns';
import { DropIcon, ThermometerIcon, WarningIcon } from '@phosphor-icons/react';

import { Button, ChartEmptyFrame, EmptyState, LoadingSkeleton } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import KpiTile from '@/components/features/farm-owner/farms/KpiTile';
import {
  CHART_FONT,
  CHART_LEGEND,
  X_AXIS_TICKS,
  axisTitle,
} from '@/components/features/farm-owner/analytics/analytics.constants';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useForecast } from '@/hooks/farm-owner/useAnalytics';
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme';
import type { MetricForecast } from '@/apis/farm-owner/analytics.api';

// Đơn vị của 2 chỉ số được dự báo
const FORECAST_UNIT = { humidity: '%', temperature: '°C' } as const;

// Tách 1 chỉ số thành 2 đường trên cùng trục thời gian: lịch sử (liền) và dự báo (đứt, nối từ điểm thật cuối)
function splitForecast(forecast: MetricForecast | null, labels: string[]): { history: Array<number | null>; forecast: Array<number | null> } {
  const historyByTime = new Map<string, number>();
  const forecastByTime = new Map<string, number>();
  for (const point of forecast?.history ?? []) historyByTime.set(point.timestamp, point.value);
  for (const point of forecast?.forecast ?? []) forecastByTime.set(point.timestamp, point.value);
  const lastHistory = forecast?.history[forecast.history.length - 1];
  if (lastHistory) forecastByTime.set(lastHistory.timestamp, lastHistory.value);
  return {
    history: labels.map(time => historyByTime.get(time) ?? null),
    forecast: labels.map(time => forecastByTime.get(time) ?? null),
  };
}

interface ForecastCardProps {
  zoneId: string;
}

// Dự báo độ ẩm, nhiệt độ 60 phút tới kèm sai số đánh giá lùi (ANALYTICS-FR-009)
export default function ForecastCard({ zoneId }: ForecastCardProps): JSX.Element {
  const { t, exact } = useTranslation(analyticsDict);
  const { data, isLoading, isError, refetch } = useForecast(zoneId);

  // Sai số dạng ±x kèm đơn vị
  const errorText = (value: number | null | undefined, unit: string): string => {
    if (value === null || value === undefined) return NO_VALUE;
    return `±${exact(value, 1)}${unit}`;
  };

  const labels = useMemo(() => {
    const times = new Set<string>();
    for (const forecast of [data?.humidity, data?.temperature]) {
      for (const point of forecast?.history ?? []) times.add(point.timestamp);
      for (const point of forecast?.forecast ?? []) times.add(point.timestamp);
    }
    return [...times].sort();
  }, [data]);

  const chartData = useMemo(() => {
    const humidity = splitForecast(data?.humidity ?? null, labels);
    const temperature = splitForecast(data?.temperature ?? null, labels);
    const line = { tension: 0.35, pointRadius: 0, borderWidth: 2, spanGaps: true };
    return {
      labels: labels.map(time => format(parseISO(time), 'HH:mm')),
      datasets: [
        { label: t('chart.humidity'), data: humidity.history, borderColor: CHART_COLORS.accentGreen, yAxisID: 'y', ...line },
        { label: t('chart.humidityForecast'), data: humidity.forecast, borderColor: CHART_COLORS.accentGreen, borderDash: [6, 4], yAxisID: 'y', ...line },
        { label: t('chart.temperature'), data: temperature.history, borderColor: CHART_COLORS.charcoal, yAxisID: 'y1', ...line },
        { label: t('chart.temperatureForecast'), data: temperature.forecast, borderColor: CHART_COLORS.charcoal, borderDash: [6, 4], yAxisID: 'y1', ...line },
      ],
    };
  }, [data, labels, t]);

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, legend: CHART_LEGEND },
    scales: {
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...X_AXIS_TICKS } },
      y: { ...baseChartOptions.scales.y, title: axisTitle('%RH') },
      y1: {
        position: 'right' as const,
        grid: { display: false },
        ticks: { color: CHART_COLORS.warmGray, font: CHART_FONT },
        title: axisTitle('°C'),
      },
    },
  } as ChartOptions<'line'>), []);

  const hasData = Boolean(data?.humidity || data?.temperature);
  const predicted = data?.predicted;

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
  if (!isLoading && !isError) {
    const unit = predicted ? FORECAST_UNIT[predicted.metric] : '';
    const breachParams = predicted
      ? {
        metric: t(`metric.${predicted.metric}`),
        value: `${exact(predicted.value, 1)}${unit}`,
        minutes: predicted.minutesAhead,
        limit: `${exact(predicted.limit, 1)}${unit}`,
      }
      : undefined;
    body = (
      <>
        {/* Cảnh báo sớm khi có chỉ số dự báo vượt ngưỡng */}
        {hasData && (predicted && breachParams ? (
          <p className="flex items-start gap-2 rounded-2xl border-2 border-orange-300 bg-orange-50 px-4 py-3 text-sm text-charcoal">
            <WarningIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-safetyOrange" aria-hidden="true" />
            {predicted.direction === 'above' ? t('forecast.breachUp', breachParams) : t('forecast.breachDown', breachParams)}
          </p>
        ) : (
          <p className="text-sm text-warmGray">{t('forecast.noBreach')}</p>
        ))}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <KpiTile
            icon={DropIcon}
            label={t('forecast.humidityError')}
            value={errorText(data?.humidity?.mae30, '%')}
            sub={t('forecast.errorSub', { value: errorText(data?.humidity?.mae60, '%') })}
          />
          <KpiTile
            icon={ThermometerIcon}
            label={t('forecast.temperatureError')}
            value={errorText(data?.temperature?.mae30, '°C')}
            sub={t('forecast.errorSub', { value: errorText(data?.temperature?.mae60, '°C') })}
          />
        </div>

        {hasData ? (
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <ChartEmptyFrame message={t('forecast.empty')} className="h-64" />
        )}
      </>
    );
  }

  return (
    <FarmFrame title={t('forecast.title')} description={t('forecast.subtitle')} className="h-full">
      {body}
    </FarmFrame>
  );
}
