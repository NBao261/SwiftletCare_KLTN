import { useMemo, type ReactNode } from 'react';
import { MinusIcon, TrendDownIcon, TrendUpIcon } from '@phosphor-icons/react';

import SimulatedBadge from '@/components/common/SimulatedBadge';
import { DataTable, type DataTableColumn } from '@/components/ui';
import { NO_VALUE } from '@/constants/display';
import { siteCauseDict } from '@/constants/enumLabels.i18n';
import { SITE_CAUSES } from '@/constants/siteCause';
import { farmOverviewDict, type FarmOverviewKey } from '@/constants/farmOverview.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import type { ComparisonSortKey, HouseComparisonRow } from '@/types';

type MetricKey = Exclude<ComparisonSortKey, 'name'>;

// 9 chỉ số BR-44 gộp thành 4 nhóm cột để bảng vừa màn laptop
const GROUPS: Array<{ key: string; header: FarmOverviewKey; metrics: MetricKey[] }> = [
  { key: 'environment', header: 'group.environment', metrics: ['time_in_range_pct', 'good_days_pct'] },
  { key: 'flock', header: 'group.flock', metrics: ['return_rate_avg', 'flock_trend_pct'] },
  { key: 'alerts', header: 'group.alerts', metrics: ['alerts_raised', 'alerts_open', 'mttr_min'] },
  { key: 'energyYield', header: 'group.energyYield', metrics: ['energy_kwh', 'last_cycle_yield_g'] },
];
// Chỉ số phần trăm 0–100: có thanh nhỏ dưới số
const PERCENT_METRICS = new Set<MetricKey>(['time_in_range_pct', 'good_days_pct', 'return_rate_avg']);

// Đàn tăng xanh, đàn giảm cam (cùng chiều cảnh báo tỷ lệ về thấp), không đổi xám
function trendStyle(value: number) {
  if (value > 0) return { icon: TrendUpIcon, color: 'text-accent-700' };
  if (value < 0) return { icon: TrendDownIcon, color: 'text-safetyOrange' };
  return { icon: MinusIcon, color: 'text-warmGray' };
}

interface HouseComparisonTableProps {
  rows: HouseComparisonRow[];
  // Chỉ số đang dùng để sắp: nhãn tô xanh đậm
  sort: ComparisonSortKey;
}

// ANALYTICS-FR-016, BR-44 — mỗi hàng 1 nhà, mỗi nhóm cột là các ô số nhỏ (số trên, nhãn dưới); backend sắp; không có điểm tổng hay xếp hạng
export default function HouseComparisonTable({ rows, sort }: HouseComparisonTableProps): JSX.Element {
  const { t, num, exact } = useTranslation(farmOverviewDict);
  const { t: causeLabel } = useTranslation(siteCauseDict);

  const columns = useMemo((): DataTableColumn<HouseComparisonRow>[] => {
    const trend = (value: number) => {
      const { icon: TrendIcon, color } = trendStyle(value);
      return (
        <span className={cn('inline-flex items-center gap-1', color)}>
          <TrendIcon size={14} weight="bold" aria-hidden />
          {`${value > 0 ? '+' : ''}${num(value, 1)}%`}
        </span>
      );
    };
    // Số đã định dạng của 1 chỉ số (chỉ gọi khi có số)
    const format: Record<MetricKey, (value: number) => ReactNode> = {
      time_in_range_pct: value => `${num(value, 1)}%`,
      good_days_pct: value => `${num(value, 1)}%`,
      return_rate_avg: value => `${num(value, 1)}%`,
      flock_trend_pct: trend,
      alerts_raised: value => num(value),
      alerts_open: value => <span className={cn(value > 0 && 'text-safetyOrange')}>{num(value)}</span>,
      mttr_min: value => t('unit.minutes', { n: num(value) }),
      energy_kwh: value => t('unit.kwh', { n: exact(value, 3) }),
      last_cycle_yield_g: value => t('unit.kg', { n: num(value / 1000, 2) }),
    };

    // 1 ô số: số đậm ở trên (chưa có số thì "_" xám), thanh phần trăm, nhãn nhỏ ở dưới
    const metricCell = (row: HouseComparisonRow, metric: MetricKey) => {
      const value = row[metric];
      const isSorted = sort === metric;
      return (
        <div key={metric} className="flex min-w-[5.5rem] flex-col gap-1">
          <span className={cn('text-base font-bold leading-6', value === null ? 'text-warmGray' : 'text-charcoal')}>
            {value === null ? NO_VALUE : format[metric](value)}
          </span>
          {PERCENT_METRICS.has(metric) && (
            <span className="h-1 w-16 overflow-hidden rounded-full bg-warmGray/15" aria-hidden>
              {value !== null && (
                <span className="block h-full rounded-full bg-accent-600" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
              )}
            </span>
          )}
          <span className={cn('text-xs', isSorted ? 'font-semibold text-accent-800' : 'text-warmGray')}>{t(`short.${metric}`)}</span>
        </div>
      );
    };

    return [
      {
        key: 'name',
        header: t('col.name'),
        className: 'w-48',
        render: row => (
          <div className="flex flex-col items-start gap-1.5">
            <span className="w-full truncate font-semibold text-charcoal" title={row.name}>{row.name}</span>
            <SimulatedBadge simulated={row.simulated} />
          </div>
        ),
      },
      ...GROUPS.map(group => ({
        key: group.key,
        header: t(group.header),
        render: (row: HouseComparisonRow) => (
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            {group.metrics.map(metric => metricCell(row, metric))}
          </div>
        ),
      })),
      // ALERT-FR-018, BR-44 — nguyên nhân đã gặp tại chỗ trong kỳ, số lần mỗi loại; không sắp theo cột này
      {
        key: 'site_causes',
        header: t('group.siteCauses'),
        render: row => {
          const found = SITE_CAUSES.filter(cause => row.site_causes?.[cause]);
          if (found.length === 0) return <span className="text-base font-bold text-warmGray">{NO_VALUE}</span>;
          return (
            <div className="flex max-w-[14rem] flex-wrap gap-1.5">
              {found.map(cause => (
                <span key={cause} className="rounded-full bg-warmGray/10 px-2 py-0.5 text-xs text-charcoal">
                  {`${causeLabel(cause)} · ${num(row.site_causes?.[cause] ?? 0)}`}
                </span>
              ))}
            </div>
          );
        },
      },
    ];
  }, [t, num, exact, sort, causeLabel]);

  return <DataTable columns={columns} rows={rows} getRowKey={row => row.house_id} minTableWidth={960} />;
}
