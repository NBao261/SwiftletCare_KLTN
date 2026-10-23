import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { format, parseISO } from 'date-fns';
import { CalendarCheckIcon, ChartLineIcon, TrendUpIcon, WarningIcon } from '@phosphor-icons/react';

import { Button, ChartEmptyFrame, EmptyState, LoadingSkeleton } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import KpiTile from '@/components/features/farm-owner/farms/KpiTile';
import SegmentedChips from '@/components/features/farm-owner/analytics/SegmentedChips';
import { BIRD_WEEK_OPTIONS, axisTitle, type BirdWeekOption } from '@/components/features/farm-owner/analytics/analytics.constants';
import { summarizeWeeklyReturnRates } from '@/components/features/farm-owner/analytics/analyticsMetrics';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHousesBirdCountTrends } from '@/hooks/farm-owner/useAnalytics';
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme';

interface BirdWeeklyCardProps {
  // 1 nhà, hoặc mọi nhà của farm khi lọc tất cả nhà yến (số đếm cộng theo ngày)
  houseIds: string[];
  scopeLabel: string;
}

// Tỷ lệ chim về theo tuần của cả nhà yến (ANALYTICS-FR-002, VISION-FR-011)
export default function BirdWeeklyCard({ houseIds, scopeLabel }: BirdWeeklyCardProps): JSX.Element {
  const { t, num, date } = useTranslation(analyticsDict);
  const [weeks, setWeeks] = useState<BirdWeekOption>(12);
  const { records, single, isLoading, isError, refetch } = useHousesBirdCountTrends(houseIds, weeks * 7);

  const weekOptions = BIRD_WEEK_OPTIONS.map(value => ({ value, label: t('common.weeks', { n: value }) }));
  const weeklyRates = useMemo(() => summarizeWeeklyReturnRates(records), [records]);

  let countedDays = 0;
  let rateTotal = 0;
  for (const week of weeklyRates) {
    countedDays += week.dayCount;
    rateTotal += week.averageReturnRate * week.dayCount;
  }
  // Trung bình cả kỳ: 1 nhà lấy số backend, nhiều nhà tính lại từ các ngày đã cộng
  let averageRate: number | null = countedDays > 0 ? rateTotal / countedDays : null;
  if (single) averageRate = single.avg_return_rate;
  const latestWeek = weeklyRates[weeklyRates.length - 1];
  const previousWeek = weeklyRates[weeklyRates.length - 2];
  const weekChange = latestWeek && previousWeek ? latestWeek.averageReturnRate - previousWeek.averageReturnRate : null;

  const chartData = useMemo(() => ({
    labels: weeklyRates.map(week => format(parseISO(week.weekStart), 'dd/MM')),
    datasets: [{
      label: t('chart.returnRate'),
      data: weeklyRates.map(week => Number(week.averageReturnRate.toFixed(1))),
      backgroundColor: CHART_COLORS.accentGreen,
      borderRadius: 6,
      maxBarThickness: 28,
    }],
  }), [weeklyRates, t]);

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    scales: {
      x: baseChartOptions.scales.x,
      y: { ...baseChartOptions.scales.y, min: 0, title: axisTitle('%') },
    },
  } as ChartOptions<'bar'>), []);

  // Dấu + cho số dương để đọc rõ chiều tăng
  const signedPoints = (value: number): string => `${value > 0 ? '+' : ''}${num(value, 1)}`;

  // Thân khung theo trạng thái tải, lỗi, chưa có số đếm
  let body = <LoadingSkeleton className="h-72 w-full" />;
  if (!isLoading && isError) {
    body = (
      <EmptyState
        title={t('common.loadError')}
        action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('common.retry')}</Button>}
      />
    );
  }
  if (!isLoading && !isError) {
    body = (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiTile
            icon={ChartLineIcon}
            label={t('bird.average')}
            value={averageRate === null ? NO_VALUE : num(averageRate, 1)}
            unit="%"
            sub={t('bird.averageSub', { n: num(countedDays) })}
          />
          <KpiTile
            icon={CalendarCheckIcon}
            label={t('bird.latestWeek')}
            value={latestWeek ? num(latestWeek.averageReturnRate, 1) : NO_VALUE}
            unit="%"
            sub={latestWeek ? t('bird.latestWeekSub', { date: date(latestWeek.weekStart) }) : NO_VALUE}
          />
          <KpiTile
            icon={TrendUpIcon}
            label={t('bird.change')}
            value={weekChange === null ? NO_VALUE : signedPoints(weekChange)}
            sub={t('bird.changeSub')}
          />
        </div>

        {/* Cảnh báo giảm quá mức chuyên gia đặt riêng cho từng nhà nên chỉ hiện khi xem 1 nhà */}
        {single?.is_significant_drop && single.drop_percent !== null && (
          <p className="flex items-start gap-2 rounded-2xl border-2 border-orange-300 bg-orange-50 px-4 py-3 text-sm text-charcoal">
            <WarningIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-safetyOrange" aria-hidden="true" />
            {t('bird.drop', { drop: num(single.drop_percent, 1), threshold: num(single.drop_threshold_pct) })}
          </p>
        )}

        {weeklyRates.length > 0 ? (
          <div className="h-64">
            <Bar data={chartData} options={chartOptions} />
          </div>
        ) : (
          <ChartEmptyFrame message={t('bird.empty')} className="h-64" />
        )}
      </>
    );
  }

  return (
    <FarmFrame
      title={t('bird.title')}
      description={t('bird.subtitle', { house: scopeLabel })}
      action={<SegmentedChips options={weekOptions} value={weeks} onChange={setWeeks} ariaLabel={t('bird.title')} />}
      className="h-full"
    >
      {body}
    </FarmFrame>
  );
}
