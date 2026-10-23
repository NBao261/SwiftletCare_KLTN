import { useMemo, useState } from 'react';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { Bar, BarChart, CartesianGrid, Rectangle, XAxis, YAxis, type RectangleProps } from 'recharts';

import { Card } from '@/components/ui';
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/features/farm-owner/harvest/ChartParts';
import { KILOGRAM_DIGITS, NEST_TYPES } from '@/components/features/farm-owner/harvest/harvest.constants';
import { harvestTotalsByPeriod, harvestYears, type HarvestPeriod } from '@/components/features/farm-owner/harvest/harvestMetrics';
import { harvestDict, type HarvestKey } from '@/constants/harvest.i18n';
import { useTranslation } from '@/hooks/common/useTranslation';
import { cn } from '@/lib/cn';
import { CHART_COLORS } from '@/lib/chartTheme';
import { vnYearMonth } from '@/lib/helpers';
import type { HarvestBatch, NestType } from '@/types';

type ChartMetric = 'kilograms' | 'nests';

// Một cột: nhãn kỳ, số đợt, lượng từng loại tổ (null = kỳ đó không có loại này) và loại nằm trên cùng
interface ChartRow {
  bucket: number;
  label: string;
  batches: number;
  topType: NestType | null;
  RAW: number | null;
  CLEANED: number | null;
  PREMIUM: number | null;
}

// Nút chọn mốc thời gian + tiêu đề tương ứng
const PERIOD_OPTIONS: Array<{ value: HarvestPeriod; labelKey: HarvestKey; titleKey: HarvestKey }> = [
  { value: 'month', labelKey: 'chart.periodMonth', titleKey: 'chart.titleMonth' },
  { value: 'quarter', labelKey: 'chart.periodQuarter', titleKey: 'chart.titleQuarter' },
  { value: 'year', labelKey: 'chart.periodYear', titleKey: 'chart.titleYear' },
];

// Chỉ đoạn trên cùng của mỗi cột được bo góc đỉnh
const TOP_RADIUS: [number, number, number, number] = [6, 6, 0, 0];

// Rãnh xám bọc nhóm nút, cùng kiểu nút gộp ở các trang Admin (TicketTrendsCard)
const TRACK_CLASS = 'inline-flex items-center gap-0.5 rounded-full bg-warmGray/10 p-1';

// Nhóm nút chọn 1 trong nhiều: mục đang chọn nền trắng nổi lên, mục khác chữ xám
function SegmentedControl<V extends string>({ ariaLabel, value, options, onChange }: {
  ariaLabel: string; value: V; options: Array<{ value: V; label: string }>; onChange: (value: V) => void;
}): JSX.Element {
  return (
    <div className={TRACK_CLASS} role="radiogroup" aria-label={ariaLabel}>
      {options.map(option => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-7 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors duration-150',
              isActive ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// Nút mũi tên trong bộ chuyển năm
function YearStepButton({ label, disabled, onClick, children }: {
  label: string; disabled: boolean; onClick: () => void; children: JSX.Element;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full text-charcoal transition-colors duration-150 hover:bg-white hover:shadow-card disabled:cursor-not-allowed disabled:text-warmGray/40 disabled:hover:bg-transparent disabled:hover:shadow-none"
    >
      {children}
    </button>
  );
}

// Trục dọc khi chưa có dữ liệu: đủ cao để vẽ 4 vạch lưới như khi có số
const EMPTY_AXIS_MAX = 4;

// Biểu đồ cột xếp chồng theo loại tổ (yến trắng → hồng → huyết từ dưới lên), gom theo tháng / quý / năm, chuyển giữa kg và số tổ (ANALYTICS-FR-004)
export default function HarvestYearChart({ batches }: { batches: HarvestBatch[] }): JSX.Element {
  const { t, num } = useTranslation(harvestDict);
  const currentYear = vnYearMonth(new Date()).year;
  const [period, setPeriod] = useState<HarvestPeriod>('month');
  const [year, setYear] = useState(currentYear);
  const [metric, setMetric] = useState<ChartMetric>('kilograms');

  // Năm có dữ liệu (luôn gồm năm hiện tại), mới nhất trước; năm đang chọn không còn trong danh sách thì về năm mới nhất
  const years = useMemo(() => harvestYears(batches, currentYear), [batches, currentYear]);
  const selectedYear = years.includes(year) ? year : years[0];
  const yearIndex = years.indexOf(selectedYear);
  const olderYear = years[yearIndex + 1];
  const newerYear = years[yearIndex - 1];
  const totals = useMemo(() => harvestTotalsByPeriod(batches, period, selectedYear), [batches, period, selectedYear]);
  const hasData = totals.nests.some(nests => nests > 0);
  const periodOption = PERIOD_OPTIONS.find(option => option.value === period) ?? PERIOD_OPTIONS[0];

  // Tên kỳ đầy đủ cho tooltip
  const periodName = (bucket: number): string => {
    if (period === 'month') return t('chart.tooltipMonth', { month: bucket });
    if (period === 'quarter') return t('chart.tooltipQuarter', { quarter: bucket });
    return t('chart.tooltipYear', { year: bucket });
  };

  // Màu xếp chồng từ dưới lên: yến trắng → yến hồng → yến huyết (cùng màu khung phân bổ loại tổ)
  const chartConfig = useMemo(() => ({
    RAW: { label: t('nestType.RAW'), color: CHART_COLORS.accentGreen },
    CLEANED: { label: t('nestType.CLEANED'), color: CHART_COLORS.accentDeep },
    PREMIUM: { label: t('nestType.PREMIUM'), color: CHART_COLORS.accentMoss },
  }) satisfies ChartConfig, [t]);

  // Dữ liệu cột; loại tổ không có trong kỳ để null nên không vẽ đoạn đó và tooltip bỏ dòng đó
  const chartRows = useMemo<ChartRow[]>(() => {
    const source = metric === 'kilograms' ? totals.kilogramsByType : totals.nestsByType;
    return totals.buckets.map((bucket, index) => {
      const amount = (nestType: NestType): number | null => {
        const value = source[nestType][index];
        return value > 0 ? value : null;
      };
      const label = period === 'month'
        ? t('chart.month', { month: bucket })
        : period === 'quarter' ? t('chart.quarter', { quarter: bucket }) : String(bucket);
      const row = { bucket, label, batches: totals.batches[index], RAW: amount('RAW'), CLEANED: amount('CLEANED'), PREMIUM: amount('PREMIUM') };
      const topType = [...NEST_TYPES].reverse().find(nestType => row[nestType] !== null) ?? null;
      return { ...row, topType };
    });
  }, [totals, metric, period, t]);

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h2 text-charcoal">{t(periodOption.titleKey, { year: selectedYear })}</h2>
          <p className="mt-1 text-sm text-warmGray">
            {metric === 'kilograms' ? t('chart.subtitleKilograms') : t('chart.subtitleNests')}
          </p>
        </div>
        {/* Thanh điều khiển: mốc thời gian · năm · chỉ số */}
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            ariaLabel={t('chart.periodAria')}
            value={period}
            options={PERIOD_OPTIONS.map(option => ({ value: option.value, label: t(option.labelKey) }))}
            onChange={setPeriod}
          />
          {/* Chuyển năm qua các năm có dữ liệu; xem theo năm thì hiện khoảng năm và khoá mũi tên */}
          <div className={TRACK_CLASS} role="group" aria-label={t('chart.selectYear')}>
            <YearStepButton
              label={t('chart.previousYear')}
              disabled={period === 'year' || olderYear === undefined}
              onClick={() => setYear(olderYear)}
            >
              <CaretLeftIcon size={14} weight="bold" />
            </YearStepButton>
            <span className="min-w-[4.5rem] px-1 text-center text-xs font-semibold tabular-nums text-charcoal" aria-live="polite">
              {period === 'year' ? `${years[years.length - 1]}–${years[0]}` : selectedYear}
            </span>
            <YearStepButton
              label={t('chart.nextYear')}
              disabled={period === 'year' || newerYear === undefined}
              onClick={() => setYear(newerYear)}
            >
              <CaretRightIcon size={14} weight="bold" />
            </YearStepButton>
          </div>
          <SegmentedControl
            ariaLabel={t('chart.metricAria')}
            value={metric}
            options={[{ value: 'kilograms', label: t('chart.kilograms') }, { value: 'nests', label: t('chart.nests') }]}
            onChange={setMetric}
          />
        </div>
      </div>

      {/* Không có dữ liệu vẫn vẽ khung biểu đồ (lưới + trục kỳ), chỉ bỏ cột, số trục dọc, tooltip và chú thích */}
      <div className="relative">
        <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
          <BarChart accessibilityLayer data={chartRows}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
            {hasData ? (
              <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={metric === 'kilograms'} />
            ) : (
              <YAxis tickLine={false} axisLine={false} width={40} tick={false} domain={[0, EMPTY_AXIS_MAX]} />
            )}
            {hasData && (
              <>
                <ChartTooltip
                  cursor={false}
                  content={(
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => {
                        const row = payload[0]?.payload as ChartRow | undefined;
                        return row ? t('chart.tooltipTitle', { period: periodName(row.bucket), batches: row.batches }) : '';
                      }}
                      formatter={(value, name) => (
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-warmGray">
                            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: `var(--color-${name})` }} />
                            {chartConfig[name as NestType].label}
                          </span>
                          <span className="font-semibold tabular-nums text-charcoal">
                            {metric === 'kilograms' ? num(Number(value), KILOGRAM_DIGITS) : num(Number(value))} {metric === 'kilograms' ? 'kg' : t('chart.nestUnit')}
                          </span>
                        </div>
                      )}
                    />
                  )}
                />
                <ChartLegend content={<ChartLegendContent />} />
                {/* Mỗi loại tổ 1 đoạn trong cột xếp chồng; chỉ loại nằm trên cùng bo góc đỉnh */}
                {NEST_TYPES.map(nestType => (
                  <Bar
                    key={nestType}
                    dataKey={nestType}
                    stackId="harvest"
                    fill={`var(--color-${nestType})`}
                    maxBarSize={40}
                    shape={(props: unknown) => {
                      const barProps = props as RectangleProps & { payload?: ChartRow };
                      return <Rectangle {...barProps} radius={barProps.payload?.topType === nestType ? TOP_RADIUS : 0} />;
                    }}
                  />
                ))}
              </>
            )}
          </BarChart>
        </ChartContainer>
        {!hasData && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-warmGray">
            {t('chart.emptyTitle')}
          </p>
        )}
      </div>
    </Card>
  );
}
