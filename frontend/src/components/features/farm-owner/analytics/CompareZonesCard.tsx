import { useMemo, useState } from 'react';

import { Button, DataTable, EmptyState, FilterChip, LoadingSkeleton, type DataTableColumn } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import SegmentedChips from '@/components/features/farm-owner/analytics/SegmentedChips';
import {
  ANALYTICS_RANGES,
  COMPARE_METRICS,
  MAX_COMPARE_ZONES,
  type CompareMetricKey,
} from '@/components/features/farm-owner/analytics/analytics.constants';
import { isOutsideRange, metricThresholdRange } from '@/components/features/farm-owner/analytics/analyticsMetrics';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useEnvCompare } from '@/hooks/farm-owner/useAnalytics';
import type { FlatZone } from '@/hooks/shared/useFarms';
import { cn } from '@/lib/cn';
import type { AnalyticsRange, EnvCompareZone } from '@/apis/farm-owner/analytics.api';

// Bảng 6 cột trong khung rộng toàn trang
const TABLE_MIN_WIDTH = 760;
// Đơn vị theo chỉ số so sánh
const UNIT_BY_METRIC = new Map<CompareMetricKey, string>(COMPARE_METRICS.map(metric => [metric.key, metric.unit]));

interface CompareZonesCardProps {
  zones: FlatZone[];
}

// So sánh môi trường giữa các Zone của farm (ANALYTICS-FR-005) bằng bảng, số ngoài ngưỡng riêng của từng Zone tô cam; không vẽ cột từ 0 (CH-03)
export default function CompareZonesCard({ zones }: CompareZonesCardProps): JSX.Element {
  const { t, num, exact } = useTranslation(analyticsDict);
  const [range, setRange] = useState<AnalyticsRange>('24h');
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
    <DataTable
      columns={columns}
      rows={selectedZoneIds.length === 0 ? [] : data?.zones ?? []}
      getRowKey={zone => zone.zoneId}
      emptyMessage={selectedZoneIds.length === 0 ? t('compare.empty') : t('compare.noData')}
      minTableWidth={TABLE_MIN_WIDTH}
      mobileCard={zone => (
        <div className="flex flex-col gap-1.5">
          <p className="text-body font-semibold text-charcoal">{zoneLabelById.get(zone.zoneId) ?? zone.zoneName}</p>
          {zone.metrics ? (
            <>
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-small">
                {valueCell(zone, 'temperature', 1)}
                {valueCell(zone, 'humidity', 1)}
                <span>NH3 {valueCell(zone, 'nh3_ppm', 1)}</span>
                <span>CO2 {valueCell(zone, 'co2_ppm', 0)}</span>
              </p>
              <p className="text-small text-warmGray tabular-nums">
                {t('compare.outside', { count: num(zone.metrics.anomalyCount), total: num(zone.metrics.sampleCount) })}
              </p>
            </>
          ) : (
            <p className="text-small text-warmGray">{t('compare.noData')}</p>
          )}
        </div>
      )}
    />
  );
  if (selectedZoneIds.length > 0 && isLoading) body = <LoadingSkeleton count={3} className="h-12 w-full" />;
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
      {/* Chọn Zone so sánh (không hộp lồng trong card) */}
      <div className="flex flex-col gap-2">
        <p className="label-caption">{t('compare.pick', { max: MAX_COMPARE_ZONES })}</p>
        <div className="flex flex-wrap gap-2">
          {zones.map(zone => (
            <FilterChip
              key={zone._id}
              active={selectedSet.has(zone._id)}
              label={(
                <span className="block max-w-[18rem] truncate" title={zoneLabelById.get(zone._id) ?? zone.name}>
                  {zoneLabelById.get(zone._id) ?? zone.name}
                </span>
              )}
              onClick={() => handleToggleZone(zone._id)}
            />
          ))}
        </div>
      </div>

      {body}
    </FarmFrame>
  );
}
