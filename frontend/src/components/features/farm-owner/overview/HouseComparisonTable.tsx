import { useMemo, type ReactNode } from 'react';
import { CaretDownIcon, CaretUpIcon, MinusIcon, TrendDownIcon, TrendUpIcon } from '@phosphor-icons/react';

import SimulatedBadge from '@/components/common/SimulatedBadge';
import { NO_VALUE } from '@/constants/display';
import { siteCauseDict } from '@/constants/enumLabels.i18n';
import { SITE_CAUSES } from '@/constants/siteCause';
import { farmOverviewDict, type FarmOverviewKey } from '@/constants/farmOverview.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import type { ComparisonSortKey, HouseComparisonRow } from '@/types';

type MetricKey = Exclude<ComparisonSortKey, 'name'>;

// 9 chỉ số theo 4 nhóm chủ đề, cộng nguyên nhân tại chỗ (không sắp theo cột này)
const GROUPS: Array<{ key: string; header: FarmOverviewKey; metrics: MetricKey[] }> = [
  { key: 'environment', header: 'group.environment', metrics: ['time_in_range_pct', 'good_days_pct'] },
  { key: 'flock', header: 'group.flock', metrics: ['return_rate_avg', 'flock_trend_pct'] },
  { key: 'alerts', header: 'group.alerts', metrics: ['alerts_raised', 'alerts_open', 'mttr_min'] },
  { key: 'energyYield', header: 'group.energyYield', metrics: ['energy_kwh', 'last_cycle_yield_g'] },
];
// Chỉ số phần trăm 0–100: có thanh dưới số để so nhà nào cao hơn
const PERCENT_METRICS = new Set<MetricKey>(['time_in_range_pct', 'good_days_pct', 'return_rate_avg']);

// Đàn tăng xanh, đàn giảm cam (cùng chiều cảnh báo tỷ lệ về thấp), không đổi xám; mũi tên kèm số nên không chỉ dựa vào màu
function trendStyle(value: number) {
  if (value > 0) return { icon: TrendUpIcon, color: 'text-accent-800' };
  if (value < 0) return { icon: TrendDownIcon, color: 'text-safetyOrange' };
  return { icon: MinusIcon, color: 'text-warmGray' };
}

interface HouseComparisonTableProps {
  rows: HouseComparisonRow[];
  // Cột đang sắp và chiều sắp; bấm tên cột để đổi (backend sắp)
  sort: ComparisonSortKey;
  order: 'asc' | 'desc';
  onSort: (key: ComparisonSortKey) => void;
}

// Ma trận so sánh: mỗi hàng 1 nhà, mỗi cột 1 chỉ số; không có điểm tổng hay xếp hạng
export default function HouseComparisonTable({ rows, sort, order, onSort }: HouseComparisonTableProps): JSX.Element {
  const { t, num, exact } = useTranslation(farmOverviewDict);
  const { t: causeLabel } = useTranslation(siteCauseDict);

  const format = useMemo((): Record<MetricKey, (value: number) => ReactNode> => {
    const trend = (value: number) => {
      const { icon: TrendIcon, color } = trendStyle(value);
      return (
        <span className={cn('inline-flex items-center gap-1', color)}>
          <TrendIcon size={14} weight="bold" aria-hidden />
          {`${value > 0 ? '+' : ''}${num(value, 1)}%`}
        </span>
      );
    };
    return {
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
  }, [t, num, exact]);

  // 1 giá trị: số đậm (chưa có số thì "_" xám), thanh phần trăm bên dưới
  const valueBlock = (row: HouseComparisonRow, metric: MetricKey) => {
    const value = row[metric];
    return (
      <div className="flex flex-col gap-1.5">
        <span className={cn('text-base font-bold leading-5 tabular-nums', value === null ? 'text-warmGray' : 'text-charcoal')}>
          {value === null ? NO_VALUE : format[metric](value)}
        </span>
        {PERCENT_METRICS.has(metric) && (
          <span className="h-1.5 w-full max-w-24 overflow-hidden rounded-full bg-warmGray/15" aria-hidden>
            {value !== null && <span className="block h-full rounded-full bg-accent-700" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />}
          </span>
        )}
      </div>
    );
  };

  const siteCauses = (row: HouseComparisonRow) => {
    const found = SITE_CAUSES.filter(cause => row.site_causes?.[cause]);
    if (found.length === 0) return <span className="text-base font-bold text-warmGray">{NO_VALUE}</span>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {found.map(cause => (
          <span key={cause} className="whitespace-nowrap rounded-full bg-warmGray/10 px-2.5 py-0.5 text-xs text-charcoal">
            {`${causeLabel(cause)} · ${num(row.site_causes?.[cause] ?? 0)}`}
          </span>
        ))}
      </div>
    );
  };

  // Tên cột bấm được: mũi tên chỉ chiều sắp ở cột đang dùng
  const sortButton = (key: ComparisonSortKey, label: string) => {
    const isActive = sort === key;
    return (
      <button
        type="button"
        onClick={() => onSort(key)}
        title={t(`col.${key}`)}
        className={cn('inline-flex items-center gap-1 text-left text-small font-semibold transition-colors hover:text-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-charcoal', isActive ? 'text-charcoal' : 'text-warmGray')}
      >
        {label}
        {isActive ? (order === 'asc' ? <CaretUpIcon size={12} weight="bold" aria-hidden /> : <CaretDownIcon size={12} weight="bold" aria-hidden />) : <span className="w-3" aria-hidden />}
      </button>
    );
  };
  const ariaSortOf = (key: ComparisonSortKey): 'ascending' | 'descending' | 'none' => (sort === key ? (order === 'asc' ? 'ascending' : 'descending') : 'none');

  return (
    <>
      {/* Màn rộng: ma trận, cột nhà cố định bên trái khi cuộn ngang */}
      <div className="hidden overflow-x-auto rounded-2xl border border-warmGray/15 md:block">
        <table className="w-full min-w-[1000px] border-collapse text-left">
          <thead>
            <tr className="border-b border-warmGray/10 bg-warmGray/[0.04]">
              <th scope="col" rowSpan={2} aria-sort={ariaSortOf('name')} className="sticky left-0 z-10 min-w-[9rem] border-r border-warmGray/10 bg-white px-3 py-3 align-bottom">
                {sortButton('name', t('col.name'))}
              </th>
              {GROUPS.map(group => (
                <th key={group.key} scope="colgroup" colSpan={group.metrics.length} className="border-l border-warmGray/10 px-3 pb-1 pt-3 text-xs font-semibold text-warmGray">
                  {t(group.header)}
                </th>
              ))}
              <th scope="col" rowSpan={2} className="min-w-[11rem] border-l border-warmGray/10 px-3 py-3 align-bottom text-small font-semibold text-warmGray">{t('group.siteCauses')}</th>
            </tr>
            <tr className="border-b border-warmGray/15 bg-warmGray/[0.04]">
              {GROUPS.flatMap(group => group.metrics.map((metric, index) => (
                <th key={metric} scope="col" aria-sort={ariaSortOf(metric)} className={cn('min-w-[5rem] px-3 pb-3 pt-1 align-bottom', index === 0 && 'border-l border-warmGray/10')}>
                  {sortButton(metric, t(`short.${metric}`))}
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.house_id} className="border-b border-warmGray/10 last:border-b-0 hover:bg-warmGray/[0.03]">
                <th scope="row" className="sticky left-0 z-10 border-r border-warmGray/10 bg-white px-3 py-4 text-left align-top">
                  <div className="flex flex-col items-start gap-1.5">
                    <span className="w-full truncate font-semibold text-charcoal" title={row.name}>{row.name}</span>
                    <SimulatedBadge simulated={row.simulated} />
                  </div>
                </th>
                {GROUPS.flatMap(group => group.metrics.map((metric, index) => (
                  <td key={metric} className={cn('px-3 py-4 align-top', index === 0 && 'border-l border-warmGray/10', sort === metric && 'bg-warmGray/[0.05]')}>
                    {valueBlock(row, metric)}
                  </td>
                )))}
                <td className="border-l border-warmGray/10 px-3 py-4 align-top">{siteCauses(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Điện thoại: mỗi nhà một thẻ, các chỉ số theo nhóm */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map(row => (
          <article key={row.house_id} className="flex flex-col gap-3 rounded-2xl border border-warmGray/15 p-4">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-body font-bold text-charcoal">{row.name}</h3>
              <SimulatedBadge simulated={row.simulated} />
            </div>
            {GROUPS.map(group => (
              <div key={group.key} className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-warmGray">{t(group.header)}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {group.metrics.map(metric => (
                    <div key={metric} className="flex flex-col gap-1">
                      <span className="text-small text-warmGray">{t(`short.${metric}`)}</span>
                      {valueBlock(row, metric)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-warmGray">{t('group.siteCauses')}</p>
              {siteCauses(row)}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
