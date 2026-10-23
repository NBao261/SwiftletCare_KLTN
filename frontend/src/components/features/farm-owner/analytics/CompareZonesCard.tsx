import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';

import { Button, ChartEmptyFrame, DataTable, EmptyState, FilterChip, LoadingSkeleton, type DataTableColumn } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import SegmentedChips from '@/components/features/farm-owner/analytics/SegmentedChips';
import {
  ANALYTICS_RANGES,
  COMPARE_METRICS,
  MAX_COMPARE_ZONES,
  axisTitle,
  type CompareMetricKey,
} from '@/components/features/farm-owner/analytics/analytics.constants';
import { isOutsideRange, metricThresholdRange } from '@/components/features/farm-owner/analytics/analyticsMetrics';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useEnvCompare } from '@/hooks/farm-owner/useAnalytics';
import type { FlatZone } from '@/hooks/shared/useFarms';
import { cn } from '@/lib/cn';
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme';
import type { AnalyticsRange, EnvCompareZone } from '@/apis/farm-owner/analytics.api';

// Bảng 6 cột trong khung rộng toàn trang
const TABLE_MIN_WIDTH = 760;

// Đơn vị theo chỉ số so sánh
const UNIT_BY_METRIC = new Map<CompareMetricKey, string>(COMPARE_METRICS.map(metric => [metric.key, metric.unit]));

interface CompareZonesCardProps {
  zones: FlatZone[];
}

// So sánh môi trường giữa các Zone của farm (ANALYTICS-FR-005), đối chiếu ngưỡng riêng của từng Zone
export default function CompareZonesCard({ zones }: CompareZonesCardProps): JSX.Element {
  const { t, num, exact } = useTranslation(analyticsDict);
  const [range, setRange] = useState<AnalyticsRange>('24h');
  const [metric, setMetric] = useState<CompareMetricKey>('temperature');
  // null = chưa tự chọn, mặc định so sánh tối đa 6 Zone đầu tiên
  const [pickedZoneIds, setPickedZoneIds] = useState<string[] | null>(null);

  const zoneLabelById = useMemo(
    () => new Map(zones.map(zone => [zone._id, t('page.zoneOption', { house: zone.houseName, zone: zone.name })])),
    [zones, t],
  );
  const selectedZoneIds = useMemo(() => {
    const source = pickedZoneIds ?? zones.slice(0, MAX_COMPARE_ZONES).map(zone => zone._id);
    return source.filter(zoneId => zoneLabelById.has(zoneId));
  }, [pickedZoneIds, zones, zoneLabelById]);
  const selectedSet = useMemo(() => new Set(selectedZoneIds), [selectedZoneIds]);
  const { data, isLoading, isError, refetch } = useEnvCompare(selectedZoneIds, range);

  const rangeOptions = ANALYTICS_RANGES.map(value => ({ value, label: t(`range.${value}`) }));
  const metricUnit = UNIT_BY_METRIC.get(metric) ?? '';

  function handleToggleZone(zoneId: string): void {
    if (selectedSet.has(zoneId)) {
      setPickedZoneIds(selectedZoneIds.filter(selectedId => selectedId !== zoneId));
      return;
    }
    if (selectedZoneIds.length >= MAX_COMPARE_ZONES) return;
    setPickedZoneIds([...selectedZoneIds, zoneId]);
  }

  // Giá trị trung bình 1 chỉ số của Zone, null khi chưa có số đo
  const metricValue = (zone: EnvCompareZone, key: CompareMetricKey): number | null => zone.metrics?.[key] ?? null;

  const chartData = useMemo(() => {
    const compareZones = data?.zones ?? [];
    return {
      labels: compareZones.map(zone => zoneLabelById.get(zone.zoneId) ?? zone.zoneName),
      datasets: [{
        label: t(`metric.${metric}`),
        data: compareZones.map(zone => zone.metrics?.[metric] ?? null),
        // Cột cam khi Zone đang ngoài ngưỡng của chính nó
        backgroundColor: compareZones.map(zone => {
          const value = zone.metrics?.[metric];
          if (value === undefined) return CHART_COLORS.gray300;
          return isOutsideRange(value, metricThresholdRange(metric, zone.thresholds)) ? CHART_COLORS.climateOrange : CHART_COLORS.accentGreen;
        }),
        borderRadius: 8,
        maxBarThickness: 48,
      }],
    };
  }, [data, metric, zoneLabelById, t]);

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    scales: {
      x: baseChartOptions.scales.x,
      y: { ...baseChartOptions.scales.y, title: axisTitle(metricUnit) },
    },
  } as ChartOptions<'bar'>), [metricUnit]);

  // Ô giá trị trung bình, cam đậm khi ngoài ngưỡng của Zone
  const valueCell = (zone: EnvCompareZone, key: CompareMetricKey, digits: number): JSX.Element => {
    const value = metricValue(zone, key);
    if (value === null) return <span className="text-warmGray">{NO_VALUE}</span>;
    const isOutside = isOutsideRange(value, metricThresholdRange(key, zone.thresholds));
    return (
      <span className={cn('tabular-nums', isOutside && 'font-bold text-climateOrange')}>
        {exact(value, digits)} {UNIT_BY_METRIC.get(key)}
      </span>
    );
  };

  const columns: DataTableColumn<EnvCompareZone>[] = [
    {
      key: 'zone',
      header: t('compare.colZone'),
      className: 'w-[24%]',
      render: zone => <p className="truncate font-semibold">{zoneLabelById.get(zone.zoneId) ?? zone.zoneName}</p>,
    },
    { key: 'temperature', header: t('compare.colTemperature'), className: 'w-[14%]', render: zone => valueCell(zone, 'temperature', 1) },
    { key: 'humidity', header: t('compare.colHumidity'), className: 'w-[14%]', render: zone => valueCell(zone, 'humidity', 1) },
    { key: 'nh3', header: t('compare.colNh3'), className: 'w-[14%]', render: zone => valueCell(zone, 'nh3_ppm', 1) },
    { key: 'co2', header: t('compare.colCo2'), className: 'w-[14%]', render: zone => valueCell(zone, 'co2_ppm', 0) },
    {
      key: 'outside',
      header: t('compare.colOutside'),
      className: 'w-[20%]',
      render: zone => {
        if (!zone.metrics) return <span className="text-warmGray">{t('compare.noData')}</span>;
        return (
          <span className="tabular-nums">
            {t('compare.outside', { count: num(zone.metrics.anomalyCount), total: num(zone.metrics.sampleCount) })}
          </span>
        );
      },
    },
  ];

  // Thân khung theo trạng thái chưa chọn, tải, lỗi
  let body = (
    <>
      <div className="h-72">
        <Bar data={chartData} options={chartOptions} />
      </div>
      <DataTable
        columns={columns}
        rows={data?.zones ?? []}
        getRowKey={zone => zone.zoneId}
        emptyMessage={t('compare.noData')}
        minTableWidth={TABLE_MIN_WIDTH}
      />
    </>
  );
  if (selectedZoneIds.length === 0) body = <ChartEmptyFrame message={t('compare.empty')} className="h-72" />;
  if (selectedZoneIds.length > 0 && isLoading) body = <LoadingSkeleton className="h-72 w-full" />;
  if (selectedZoneIds.length > 0 && isError) {
    body = (
      <EmptyState
        title={t('common.loadError')}
        action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('common.retry')}</Button>}
      />
    );
  }

  return (
    <FarmFrame
      title={t('compare.title')}
      description={t('compare.subtitle')}
      action={<SegmentedChips options={rangeOptions} value={range} onChange={setRange} ariaLabel={t('range.label')} />}
    >
      {/* Chọn chỉ số */}
      <div className="flex flex-wrap gap-2">
        {COMPARE_METRICS.map(option => (
          <FilterChip key={option.key} active={metric === option.key} label={t(`metric.${option.key}`)} onClick={() => setMetric(option.key)} />
        ))}
      </div>

      {/* Chọn Zone so sánh */}
      <div className="flex flex-col gap-2 rounded-2xl border border-warmGray/15 p-4">
        <p className="label-caption">{t('compare.pick', { max: MAX_COMPARE_ZONES })}</p>
        <div className="flex flex-wrap gap-2">
          {zones.map(zone => (
            <FilterChip
              key={zone._id}
              active={selectedSet.has(zone._id)}
              label={zoneLabelById.get(zone._id) ?? zone.name}
              onClick={() => handleToggleZone(zone._id)}
            />
          ))}
        </div>
      </div>

      {body}
    </FarmFrame>
  );
}
