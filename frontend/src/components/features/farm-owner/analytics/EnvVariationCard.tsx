import { useMemo, useState } from 'react';

import WeatherSource from '@/components/common/WeatherSource';
import { Button, ChartEmptyFrame, EmptyState, LoadingSkeleton } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import LineChartPanel, { type LineSeries } from '@/components/features/farm-owner/analytics/LineChartPanel';
import SegmentedChips from '@/components/features/farm-owner/analytics/SegmentedChips';
import StatStrip, { type StatItem } from '@/components/features/farm-owner/analytics/StatStrip';
import { ANALYTICS_RANGES, SERIES_COLORS, labelForRange } from '@/components/features/farm-owner/analytics/analytics.constants';
import { alignOutdoorWeather, totalRainfall } from '@/components/features/farm-owner/analytics/analyticsMetrics';
import { analyticsDict } from '@/constants/analytics.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useEnvSummary } from '@/hooks/farm-owner/useAnalytics';
import { useTelemetry } from '@/hooks/farm-owner/useTelemetry';
import { cn } from '@/lib/cn';
import { CHART_COLORS } from '@/lib/chartTheme';
import type { AnalyticsRange } from '@/apis/farm-owner/analytics.api';
import type { Thresholds, ZoneThresholdHistoryEntry } from '@/types';
import { thresholdSource } from '@/components/features/farm-owner/dashboard/dashboardMetrics';
import { NO_VALUE } from '@/constants/display';

// 1 bản ghi thời tiết ngoài trời là số liệu của 1 giờ
const HOUR_MS = 3600_000;

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
const SETTER_ROLES = new Set(['FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN', 'ADMIN']);
type SetterRole = 'FARM_OWNER' | 'DOMAIN_EXPERT' | 'FARM_TECHNICIAN' | 'ADMIN';

// Số mới nhất khác rỗng của một mảng
function lastValue(values: Array<number | null>): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value !== null) return value;
  }
  return null;
}

// Dòng phụ tooltip theo vị trí điểm; thiếu số trong nhà hoặc ngoài trời thì không ghi
function diffLine(indoor: Array<number | null>, outdoor: Array<number | null>, describe: (gap: number) => string) {
  return (index: number): string | null => {
    const inside = indoor[index];
    const outside = outdoor[index];
    if (inside === null || inside === undefined || outside === null || outside === undefined) return null;
    return describe(outside - inside);
  };
}

// Nhiệt độ và độ ẩm trong nhà so với ngoài trời theo thời gian: số hiện tại ở đầu, mỗi đại lượng một biểu đồ, kèm số đo khí
export default function EnvVariationCard({ zoneId, thresholds, thresholdHistory }: EnvVariationCardProps): JSX.Element {
  const { t, exact, ago, date, num, hourMinute } = useTranslation(analyticsDict);
  const [range, setRange] = useState<AnalyticsRange>('24h');
  const { data, isLoading, isError, refetch } = useEnvSummary(zoneId, range);
  const telemetry = useTelemetry(zoneId);

  const rangeOptions = ANALYTICS_RANGES.map(value => ({ value, label: t(`range.${value}`) }));

  const model = useMemo(() => {
    const series = data?.series ?? [];
    // Chưa có số đo trong nhà (thiết bị chưa gửi) thì trục thời gian lấy theo giờ thời tiết, vẫn thấy ngoài trời
    const timeline = series.length > 0 ? series.map(point => point.timestamp) : (data?.outdoor ?? []).map(point => point.timestamp);
    // Mỗi điểm ngoài trời phủ 1 giờ, hoặc cả bucket khi bucket dài hơn 1 giờ
    const outdoor = alignOutdoorWeather(timeline, data?.outdoor ?? [], Math.max(data?.bucketMs ?? 0, HOUR_MS));
    const hasOutdoor = outdoor.some(point => point !== null);
    const indoorTemperature = series.map(point => point.temperature ?? null);
    const indoorHumidity = series.map(point => point.humidity ?? null);
    const outdoorTemperature = outdoor.map(point => point?.temperature ?? null);
    const outdoorHumidity = outdoor.map(point => point?.humidity ?? null);
    const build = (indoor: Array<number | null>, outdoorValues: Array<number | null>): LineSeries[] => [
      ...(series.length > 0 ? [{ label: t('chart.indoor'), data: indoor, color: SERIES_COLORS.own }] : []),
      ...(hasOutdoor ? [{ label: t('chart.outdoor'), data: outdoorValues, color: SERIES_COLORS.reference, isDashed: true }] : []),
    ];
    // Số ngoài trời mới nhất theo bản ghi giờ (không theo bucket của biểu đồ)
    const latestOutdoor = [...(data?.outdoor ?? [])].reverse().find(point => point.temperature !== null || point.humidity !== null);
    return {
      labels: timeline.map(timestamp => labelForRange(timestamp, range)),
      temperature: build(indoorTemperature, outdoorTemperature),
      humidity: build(indoorHumidity, outdoorHumidity),
      indoorTemperature, indoorHumidity, outdoorTemperature, outdoorHumidity,
      nowIndoorTemperature: lastValue(indoorTemperature),
      nowIndoorHumidity: lastValue(indoorHumidity),
      latestOutdoor,
    };
  }, [data, range, t]);

  const temperatureBand = useMemo(
    () => (thresholds ? { min: thresholds.temp_min, max: thresholds.temp_max, label: t('env.bandLabel', { min: thresholds.temp_min, max: thresholds.temp_max, unit: '°C' }) } : undefined),
    [thresholds, t],
  );
  const humidityBand = useMemo(
    () => (thresholds ? { min: thresholds.humidity_min, max: thresholds.humidity_max, label: t('env.bandLabel', { min: thresholds.humidity_min, max: thresholds.humidity_max, unit: '%' }) } : undefined),
    [thresholds, t],
  );
  const outOfRange = useMemo(() => ({ color: CHART_COLORS.climateOrange, label: t('chart.outsideRange') }), [t]);

  const oneDecimal = (value: number) => exact(value, 1);

  // Tooltip: số ngoài trời lệch bao nhiêu so với trong nhà tại cùng thời điểm
  const temperatureDiff = useMemo(
    () => diffLine(model.indoorTemperature, model.outdoorTemperature, gap => t('env.tooltipDiff', { value: `${gap > 0 ? '+' : ''}${exact(gap, 1)}°C` })),
    [model, t, exact],
  );
  const humidityDiff = useMemo(
    () => diffLine(model.indoorHumidity, model.outdoorHumidity, gap => t('env.tooltipDiff', { value: `${gap > 0 ? '+' : ''}${exact(gap, 1)}%` })),
    [model, t, exact],
  );

  const rainfall = totalRainfall(data?.outdoor ?? []);
  const nh3 = telemetry.data.nh3_ppm;
  const co2 = telemetry.data.co2_ppm;

  // Ai đặt ngưỡng đang áp: cùng cách đọc với trang Tổng quan (threshold_history backend trả về)
  const source = thresholdSource(thresholdHistory);
  let sourceText = t('env.sourceDefault');
  if (!source.isDefault) {
    const setterKey = source.role && SETTER_ROLES.has(source.role) ? `env.setter.${source.role as SetterRole}` as const : 'env.setter.other';
    sourceText = t('env.sourceManual', { setter: t(setterKey), date: source.changedAt ? date(source.changedAt) : NO_VALUE });
  }

  // Dải số hiện tại: trong nhà (kèm trong hay ngoài ngưỡng) cạnh ngoài trời (kèm lệch bao nhiêu)
  const outdoorHour = model.latestOutdoor
    ? t('env.outdoorHour', { from: hourMinute(model.latestOutdoor.timestamp) })
    : '';
  const relation = (outdoor: number | null | undefined, indoor: number | null, unit: string): string => {
    if (outdoor === null || outdoor === undefined || indoor === null) return outdoorHour;
    const gap = outdoor - indoor;
    const compare = Math.abs(gap) < 0.05 ? t('env.same') : t(gap > 0 ? 'env.higher' : 'env.lower', { value: `${exact(Math.abs(gap), 1)}${unit}` });
    return `${compare} · ${outdoorHour}`;
  };
  const rangeStatus = (value: number | null, min: number | undefined, max: number | undefined): Pick<StatItem, 'sub' | 'isWarning'> => {
    if (value === null || min === undefined || max === undefined) return { sub: t('env.noReading') };
    const isOutside = value < min || value > max;
    return { sub: t(isOutside ? 'env.outRange' : 'env.inRange'), isWarning: isOutside };
  };
  const nowItems: StatItem[] = [
    { label: t('env.nowIndoorTemperature'), value: model.nowIndoorTemperature === null ? NO_VALUE : num(model.nowIndoorTemperature, 1), unit: '°C', ...rangeStatus(model.nowIndoorTemperature, thresholds?.temp_min, thresholds?.temp_max) },
    { label: t('env.nowOutdoorTemperature'), value: model.latestOutdoor?.temperature == null ? NO_VALUE : num(model.latestOutdoor.temperature, 1), unit: '°C', sub: relation(model.latestOutdoor?.temperature, model.nowIndoorTemperature, '°C') },
    { label: t('env.nowIndoorHumidity'), value: model.nowIndoorHumidity === null ? NO_VALUE : num(model.nowIndoorHumidity, 1), unit: '%', ...rangeStatus(model.nowIndoorHumidity, thresholds?.humidity_min, thresholds?.humidity_max) },
    { label: t('env.nowOutdoorHumidity'), value: model.latestOutdoor?.humidity == null ? NO_VALUE : num(model.latestOutdoor.humidity, 0), unit: '%', sub: relation(model.latestOutdoor?.humidity, model.nowIndoorHumidity, '%') },
  ];

  // Biểu đồ theo trạng thái tải, lỗi, rỗng
  let charts = <LoadingSkeleton className="h-64 w-full" />;
  if (!isLoading && isError) {
    charts = (
      <EmptyState
        title={t('common.loadError')}
        action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('common.retry')}</Button>}
      />
    );
  }
  const hasChartData = Boolean(data && (data.series.length > 0 || data.outdoor.length > 0));
  if (!isLoading && !isError && !hasChartData) {
    charts = <ChartEmptyFrame message={t('env.empty')} className="h-64" />;
  }
  if (!isLoading && !isError && hasChartData) {
    charts = (
      <>
        <StatStrip items={nowItems} />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <LineChartPanel title={t('env.temperatureTitle')} unit="°C" labels={model.labels} series={model.temperature} band={temperatureBand} outOfRange={outOfRange} extraLine={temperatureDiff} formatValue={oneDecimal} heightClass="h-64" />
          <LineChartPanel title={t('env.humidityTitle')} unit="%" labels={model.labels} series={model.humidity} band={humidityBand} outOfRange={outOfRange} extraLine={humidityDiff} formatValue={oneDecimal} heightClass="h-64" />
        </div>
      </>
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
      </div>
      {charts}
      {/* Dải xanh là ngưỡng an toàn của Zone; thời tiết ngoài trời chỉ để đối chiếu, không điều khiển thiết bị */}
      {thresholds && <p className="text-xs text-warmGray">{sourceText}</p>}
      {data && hasChartData && (
        <p className="text-xs text-warmGray">
          {data.series.length === 0 && `${t('env.indoorEmpty')} · `}
          {data.outdoor.length > 0
            ? t('env.outdoorNote', { rain: rainfall === null ? NO_VALUE : num(rainfall, 1) })
            : t('env.outdoorEmpty')}
        </p>
      )}
      {data && data.outdoor.length > 0 && <WeatherSource />}
    </FarmFrame>
  );
}
