import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { Chart as ChartInstance, ChartOptions, Plugin } from 'chart.js';

import { Button, ChartEmptyFrame, EmptyState, LoadingSkeleton } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import SegmentedChips from '@/components/features/farm-owner/analytics/SegmentedChips';
import {
  ANALYTICS_RANGES,
  CHART_FONT,
  CHART_LEGEND,
  THRESHOLD_BAND_FILL,
  X_AXIS_TICKS,
  axisTitle,
  labelForRange,
} from '@/components/features/farm-owner/analytics/analytics.constants';
import { analyticsDict } from '@/constants/analytics.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useEnvSummary } from '@/hooks/farm-owner/useAnalytics';
import { useTelemetry } from '@/hooks/farm-owner/useTelemetry';
import { cn } from '@/lib/cn';
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme';
import type { AnalyticsRange } from '@/apis/farm-owner/analytics.api';
import type { Thresholds, ZoneThresholdHistoryEntry } from '@/types';
import { thresholdSource } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import { NO_VALUE } from '@/constants/display';

// Tô nền dải ngưỡng nhiệt độ trên trục trái, kẹp trong vùng vẽ để không đè lên chú thích
function thresholdBandPlugin(min: number, max: number): Plugin<'line'> {
  return {
    id: 'thresholdBand',
    beforeDatasetsDraw(chart: ChartInstance<'line'>) {
      const { ctx, chartArea, scales } = chart;
      const yScale = scales.y;
      if (!chartArea || !yScale) return;
      const top = Math.max(chartArea.top, Math.min(yScale.getPixelForValue(max), chartArea.bottom));
      const bottom = Math.min(chartArea.bottom, Math.max(yScale.getPixelForValue(min), chartArea.top));
      if (bottom <= top) return;
      ctx.save();
      ctx.fillStyle = THRESHOLD_BAND_FILL;
      ctx.fillRect(chartArea.left, top, chartArea.right - chartArea.left, bottom - top);
      ctx.restore();
    },
  };
}

interface GasChipProps {
  label: string;
  isOverThreshold: boolean;
}

// Chip số đo khí: xám khi an toàn, cam khi vượt ngưỡng cảnh báo
function GasChip({ label, isOverThreshold }: GasChipProps): JSX.Element {
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
        isOverThreshold ? 'border-climateOrange/40 bg-climateOrange/[0.06] text-climateOrange' : 'border-warmGray/15 text-charcoal',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', isOverThreshold ? 'bg-climateOrange' : 'bg-warmGray/40')} />
      {label}
    </span>
  );
}

interface EnvVariationCardProps {
  zoneId: string;
  thresholds?: Thresholds;
  // Lịch sử ngưỡng của Zone (backend trả kèm Zone) để ghi ai đặt ngưỡng đang áp
  thresholdHistory?: ZoneThresholdHistoryEntry[];
}

// Vai trò người đặt ngưỡng có nhãn riêng
const SETTER_ROLES = new Set(['FARM_OWNER', 'DOMAIN_EXPERT', 'TECHNICIAN', 'ADMIN']);
type SetterRole = 'FARM_OWNER' | 'DOMAIN_EXPERT' | 'TECHNICIAN' | 'ADMIN';

// Biến thiên nhiệt độ, độ ẩm theo khoảng thời gian (ANALYTICS-FR-001) kèm số đo khí trực tiếp
export default function EnvVariationCard({ zoneId, thresholds, thresholdHistory }: EnvVariationCardProps): JSX.Element {
  const { t, exact, ago, date } = useTranslation(analyticsDict);
  const [range, setRange] = useState<AnalyticsRange>('24h');
  const { data, isLoading, isError, refetch } = useEnvSummary(zoneId, range);
  const telemetry = useTelemetry(zoneId);

  const rangeOptions = ANALYTICS_RANGES.map(value => ({ value, label: t(`range.${value}`) }));

  const chartData = useMemo(() => {
    const series = data?.series ?? [];
    const line = { fill: false, tension: 0.35, pointRadius: 0, borderWidth: 2, spanGaps: true };
    return {
      labels: series.map(point => labelForRange(point.timestamp, range)),
      datasets: [
        { label: t('chart.temperature'), data: series.map(point => point.temperature ?? null), borderColor: CHART_COLORS.charcoal, yAxisID: 'y', ...line },
        { label: t('chart.humidity'), data: series.map(point => point.humidity ?? null), borderColor: CHART_COLORS.accentGreen, yAxisID: 'y1', ...line },
      ],
    };
  }, [data, range, t]);

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, legend: CHART_LEGEND },
    scales: {
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...X_AXIS_TICKS } },
      y: { ...baseChartOptions.scales.y, title: axisTitle('°C') },
      y1: {
        position: 'right' as const,
        grid: { display: false },
        ticks: { color: CHART_COLORS.warmGray, font: CHART_FONT },
        title: axisTitle('%'),
      },
    },
  } as ChartOptions<'line'>), []);

  const plugins = useMemo(
    () => (thresholds ? [thresholdBandPlugin(thresholds.temp_min, thresholds.temp_max)] : []),
    [thresholds],
  );

  const nh3 = telemetry.data.nh3_ppm;
  const co2 = telemetry.data.co2_ppm;

  // Ai đặt ngưỡng đang áp — cùng cách đọc với trang Tổng quan (threshold_history backend trả về)
  const source = thresholdSource(thresholdHistory);
  let sourceText = t('env.sourceDefault');
  if (!source.isDefault) {
    const setterKey = source.role && SETTER_ROLES.has(source.role) ? `env.setter.${source.role as SetterRole}` as const : 'env.setter.other';
    sourceText = t('env.sourceManual', { setter: t(setterKey), date: source.changedAt ? date(source.changedAt) : NO_VALUE });
  }

  // Biểu đồ theo trạng thái tải, lỗi, rỗng
  let chart = <LoadingSkeleton className="h-72 w-full" />;
  if (!isLoading && isError) {
    chart = (
      <EmptyState
        title={t('common.loadError')}
        action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('common.retry')}</Button>}
      />
    );
  }
  if (!isLoading && !isError && (!data || data.series.length === 0)) {
    chart = <ChartEmptyFrame message={t('env.empty')} className="h-72" />;
  }
  if (!isLoading && !isError && data && data.series.length > 0) {
    chart = (
      <div className="h-72">
        {/* react-chartjs-2 chỉ đọc plugins lúc tạo chart nên remount khi ngưỡng đổi */}
        <Line key={`${thresholds?.temp_min ?? 'none'}-${thresholds?.temp_max ?? 'none'}`} data={chartData} options={chartOptions} plugins={plugins} />
      </div>
    );
  }

  return (
    <FarmFrame
      title={t('env.title')}
      description={t('env.subtitle')}
      action={<SegmentedChips options={rangeOptions} value={range} onChange={setRange} ariaLabel={t('range.label')} />}
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* Mốc số đo khí gần nhất; chưa có số đo thì không hiện */}
        {telemetry.data.timestamp && (
          <span className="text-small font-semibold text-warmGray">{t('env.lastReading', { ago: ago(telemetry.data.timestamp) })}</span>
        )}
        {thresholds && nh3 !== undefined && (
          <GasChip
            label={t('env.gas', { gas: 'NH3', value: exact(nh3, 1), max: thresholds.nh3_max })}
            isOverThreshold={nh3 > thresholds.nh3_max}
          />
        )}
        {thresholds && co2 !== undefined && (
          <GasChip
            label={t('env.gas', { gas: 'CO2', value: exact(co2, 0), max: thresholds.co2_max })}
            isOverThreshold={co2 > thresholds.co2_max}
          />
        )}
        {thresholds && (
          <span className="rounded-full border border-warmGray/15 bg-warmGray/10 px-3 py-1 text-xs font-medium text-graphite">
            {t('env.range', {
              temperatureMin: thresholds.temp_min,
              temperatureMax: thresholds.temp_max,
              humidityMin: thresholds.humidity_min,
              humidityMax: thresholds.humidity_max,
            })}
          </span>
        )}
      </div>
      {thresholds && <p className="text-xs text-warmGray">{sourceText}</p>}
      {chart}
    </FarmFrame>
  );
}
