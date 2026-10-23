import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { Chart as ChartInstance, ChartOptions, Plugin } from 'chart.js';
import { ArrowsClockwiseIcon, DropIcon, RobotIcon, ThermometerIcon } from '@phosphor-icons/react';

import { Button, ChartEmptyFrame, EmptyState, LoadingSkeleton } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import KpiTile from '@/components/features/farm-owner/farms/KpiTile';
import FuzzyTuningModal from '@/components/features/farm-owner/analytics/FuzzyTuningModal';
import SegmentedChips from '@/components/features/farm-owner/analytics/SegmentedChips';
import {
  ANALYTICS_RANGES,
  CHART_FONT,
  CHART_LEGEND,
  X_AXIS_TICKS,
  axisTitle,
  labelForRange,
} from '@/components/features/farm-owner/analytics/analytics.constants';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { usePermission } from '@/hooks/common/usePermission';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useAutonomy, useControlPerformance } from '@/hooks/farm-owner/useAnalytics';
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme';
import type { AnalyticsRange, ControlPerformanceResponse } from '@/apis/farm-owner/analytics.api';

// Vạch dọc nét đứt tại các lần chỉnh hệ số để so hành vi trước và sau
function tuningMarkersPlugin(indices: number[], label: string): Plugin<'line'> {
  return {
    id: 'tuningMarkers',
    afterDatasetsDraw(chart: ChartInstance<'line'>) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x) return;
      ctx.save();
      ctx.strokeStyle = CHART_COLORS.graphite;
      ctx.fillStyle = CHART_COLORS.graphite;
      ctx.setLineDash([4, 4]);
      ctx.font = '10px "Plus Jakarta Sans", sans-serif';
      for (const index of indices) {
        const x = scales.x.getPixelForValue(index);
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.fillText(label, x + 4, chartArea.top + 10);
      }
      ctx.restore();
    },
  };
}

// Vị trí bucket đầu tiên từ mỗi lần chỉnh hệ số trở đi, duyệt 2 con trỏ nên O(n + m)
function tuningMarkerIndices(data: ControlPerformanceResponse | undefined): number[] {
  if (!data) return [];
  const changeTimes = data.tuning_changes.map(change => change.changed_at).sort();
  const indices: number[] = [];
  let seriesIndex = 0;
  for (const changeTime of changeTimes) {
    while (seriesIndex < data.series.length && data.series[seriesIndex].timestamp < changeTime) seriesIndex += 1;
    if (seriesIndex >= data.series.length) break;
    if (indices[indices.length - 1] !== seriesIndex) indices.push(seriesIndex);
  }
  return indices;
}

interface AutomationCardProps {
  zoneId: string;
  zoneName: string;
}

// Hiệu quả vận hành tự động: tỷ lệ tự động (ANALYTICS-FR-011), % trong ngưỡng và biểu đồ điều khiển mờ (ANALYTICS-FR-008)
export default function AutomationCard({ zoneId, zoneName }: AutomationCardProps): JSX.Element {
  const { t, num, exact } = useTranslation(analyticsDict);
  const canTune = usePermission('FARM_OWNER');
  const [range, setRange] = useState<AnalyticsRange>('24h');
  const [isTuning, setIsTuning] = useState(false);
  const autonomy = useAutonomy(zoneId, range);
  const performance = useControlPerformance(zoneId, range);
  const data = performance.data;
  const stats = data?.stats ?? null;

  const rangeOptions = ANALYTICS_RANGES.map(value => ({ value, label: t(`range.${value}`) }));

  // Số 1 chữ số lẻ, chưa có thì gạch ngang
  const oneDecimal = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return NO_VALUE;
    return num(value, 1);
  };

  const chartData = useMemo(() => {
    const series = data?.series ?? [];
    const line = { tension: 0.35, pointRadius: 0, borderWidth: 2, spanGaps: true };
    return {
      labels: series.map(point => labelForRange(point.timestamp, range)),
      datasets: [
        { label: t('chart.humidity'), data: series.map(point => point.humidity ?? null), borderColor: CHART_COLORS.accentGreen, yAxisID: 'y', ...line },
        { label: t('chart.misting'), data: series.map(point => point.misting_pct ?? null), borderColor: CHART_COLORS.charcoal, yAxisID: 'y1', ...line },
        { label: t('chart.ventilation'), data: series.map(point => point.ventilation_pct ?? null), borderColor: CHART_COLORS.warmGray, borderDash: [6, 4], yAxisID: 'y1', ...line },
      ],
    };
  }, [data, range, t]);

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, legend: CHART_LEGEND },
    scales: {
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...X_AXIS_TICKS } },
      y: { ...baseChartOptions.scales.y, title: axisTitle('%RH') },
      y1: {
        position: 'right' as const,
        min: 0,
        max: 100,
        grid: { display: false },
        ticks: { color: CHART_COLORS.warmGray, font: CHART_FONT },
        title: axisTitle(t('chart.powerAxis')),
      },
    },
  } as ChartOptions<'line'>), [t]);

  const markerIndices = useMemo(() => tuningMarkerIndices(data), [data]);
  const plugins = useMemo(() => [tuningMarkersPlugin(markerIndices, t('chart.tuningMarker'))], [markerIndices, t]);

  const isLoading = autonomy.isLoading || performance.isLoading;
  const isError = autonomy.isError || performance.isError;
  const tuning = data?.fuzzy_tuning;

  // Thân khung theo trạng thái tải, lỗi, rỗng
  let body = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          icon={RobotIcon}
          label={t('automation.autoLabel')}
          value={oneDecimal(autonomy.data?.auto_mode_pct)}
          unit="%"
          sub={autonomy.data
            ? t('automation.autoSub', { count: num(autonomy.data.override_count), minutes: num(autonomy.data.manual_minutes) })
            : t('automation.noValueSub')}
        />
        <KpiTile
          icon={DropIcon}
          label={t('automation.humidityLabel')}
          value={oneDecimal(stats?.humidityInRangePct)}
          unit="%"
          sub={data
            ? t('automation.rangeSub', { min: data.thresholds.humidity_min, max: data.thresholds.humidity_max, unit: '%' })
            : t('automation.noValueSub')}
        />
        <KpiTile
          icon={ThermometerIcon}
          label={t('automation.temperatureLabel')}
          value={oneDecimal(stats?.temperatureInRangePct)}
          unit="%"
          sub={data
            ? t('automation.rangeSub', { min: data.thresholds.temp_min, max: data.thresholds.temp_max, unit: '°C' })
            : t('automation.noValueSub')}
        />
        <KpiTile
          icon={ArrowsClockwiseIcon}
          label={t('automation.switchLabel')}
          value={t('automation.switchValue', {
            misting: oneDecimal(stats?.mistingSwitchesPerHour),
            ventilation: oneDecimal(stats?.ventilationSwitchesPerHour),
          })}
          sub={t('automation.switchSub')}
        />
      </div>

      {/* Biểu đồ độ ẩm so với % phun sương và quạt */}
      {data && stats ? (
        <div className="flex flex-col gap-2">
          <p className="text-small text-warmGray">{t('automation.chartHint')}</p>
          <div className="h-72">
            {/* react-chartjs-2 chỉ đọc plugins lúc tạo chart nên remount khi vạch mốc đổi */}
            <Line key={markerIndices.join(',')} data={chartData} options={chartOptions} plugins={plugins} />
          </div>
        </div>
      ) : (
        <ChartEmptyFrame message={t('automation.empty')} className="h-72" />
      )}
    </div>
  );
  if (isLoading) body = <LoadingSkeleton className="h-96 w-full" />;
  if (isError) {
    body = (
      <EmptyState
        title={t('common.loadError')}
        action={(
          <Button variant="secondary" size="sm" onClick={() => { void autonomy.refetch(); void performance.refetch(); }}>
            {t('common.retry')}
          </Button>
        )}
      />
    );
  }

  return (
    <FarmFrame
      title={t('automation.title')}
      description={t('automation.subtitle')}
      action={<SegmentedChips options={rangeOptions} value={range} onChange={setRange} ariaLabel={t('range.label')} />}
    >
      {body}

      {/* Tiến độ tới mốc bảo trì theo thời gian chạy của từng thiết bị (TICKET-FR-018) */}
      {data && data.relay_usage.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-warmGray/15 pt-4">
          <p className="label-caption">{t('automation.maintenanceTitle')}</p>
          {data.relay_usage.map(usage => (
            <div key={usage.device_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-charcoal">
              <span className="font-semibold">{usage.device_id}</span>
              <span>
                {t('automation.maintenancePump', {
                  hours: num(usage.misting.hours),
                  hourLimit: num(data.service_limits.misting.hours),
                  switches: num(usage.misting.switches),
                  switchLimit: num(data.service_limits.misting.switches),
                })}
              </span>
              <span>
                {t('automation.maintenanceFan', {
                  hours: num(usage.ventilation.hours),
                  hourLimit: num(data.service_limits.ventilation.hours),
                  switches: num(usage.ventilation.switches),
                  switchLimit: num(data.service_limits.ventilation.switches),
                })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Hệ số logic mờ đang áp dụng và nút chỉnh (ENV-FR-021) */}
      {tuning && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-warmGray/15 pt-4">
          <p className="text-small text-warmGray">
            {t('automation.coefficients', {
              humidityBand: exact(tuning.fuzzy_humidity_band, 1),
              temperatureBand: exact(tuning.fuzzy_temp_band, 1),
              fanDryLevel: num(tuning.fuzzy_fan_dry_level),
              window: num(tuning.fuzzy_window_sec),
              filter: tuning.fuzzy_input_filter === false ? t('automation.filterOff') : t('automation.filterOn'),
            })}
            {stats && ` · ${t('automation.samples', { n: num(stats.sampleCount) })}`}
          </p>
          {canTune && (
            <Button size="sm" variant="secondary" onClick={() => setIsTuning(true)}>
              {t('automation.tune')}
            </Button>
          )}
        </div>
      )}

      {isTuning && tuning && (
        <FuzzyTuningModal zoneId={zoneId} zoneName={zoneName} current={tuning} onClose={() => setIsTuning(false)} />
      )}
    </FarmFrame>
  );
}
