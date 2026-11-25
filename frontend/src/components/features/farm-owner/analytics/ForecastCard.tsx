import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { WarningIcon } from '@phosphor-icons/react';

import { Button, ChartEmptyFrame, EmptyState, LoadingSkeleton } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import LineChartPanel, { type LineSeries } from '@/components/features/farm-owner/analytics/LineChartPanel';
import { SERIES_COLORS } from '@/components/features/farm-owner/analytics/analytics.constants';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useForecast } from '@/hooks/farm-owner/useAnalytics';
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

// Dự báo độ ẩm, nhiệt độ 60 phút tới: mỗi chỉ số một biểu đồ, kèm sai số đánh giá lùi
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

  const model = useMemo(() => {
    const seriesOf = (forecast: MetricForecast | null | undefined): LineSeries[] => {
      const split = splitForecast(forecast ?? null, labels);
      return [
        { label: t('forecast.measured'), data: split.history, color: SERIES_COLORS.own },
        { label: t('forecast.predicted'), data: split.forecast, color: SERIES_COLORS.own, isDashed: true },
      ];
    };
    return {
      labels: labels.map(time => format(parseISO(time), 'HH:mm')),
      humidity: seriesOf(data?.humidity),
      temperature: seriesOf(data?.temperature),
    };
  }, [data, labels, t]);

  const oneDecimal = (value: number) => exact(value, 1);
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

        {hasData ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="flex flex-col gap-2">
              <LineChartPanel title={t('env.humidityTitle')} unit="%" labels={model.labels} series={model.humidity} formatValue={oneDecimal} />
              <p className="text-small text-warmGray">{t('forecast.errorLine', { a: errorText(data?.humidity?.mae30, '%'), b: errorText(data?.humidity?.mae60, '%') })}</p>
            </div>
            <div className="flex flex-col gap-2">
              <LineChartPanel title={t('env.temperatureTitle')} unit="°C" labels={model.labels} series={model.temperature} formatValue={oneDecimal} />
              <p className="text-small text-warmGray">{t('forecast.errorLine', { a: errorText(data?.temperature?.mae30, '°C'), b: errorText(data?.temperature?.mae60, '°C') })}</p>
            </div>
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
