import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import { format, parseISO } from 'date-fns';
import { WarningIcon } from '@phosphor-icons/react';

import { Button, ChartEmptyFrame, EmptyState, LoadingSkeleton } from '@/components/ui';
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame';
import StatStrip from '@/components/features/farm-owner/analytics/StatStrip';
import SegmentedChips from '@/components/features/farm-owner/analytics/SegmentedChips';
import { BIRD_WEEK_OPTIONS, LINE_LEGEND, SERIES_COLORS, X_AXIS_TICKS, axisTitle, type BirdWeekOption } from '@/components/features/farm-owner/analytics/analytics.constants';
import { summarizeWeeklyReturnRates } from '@/components/features/farm-owner/analytics/analyticsMetrics';
import { analyticsDict } from '@/constants/analytics.i18n';
import { NO_VALUE } from '@/constants/display';
import { useTranslation } from '@/hooks/common/useTranslation';
import { useHousesBirdCountTrends } from '@/hooks/farm-owner/useAnalytics';
import { baseChartOptions } from '@/lib/chartTheme';

interface BirdWeeklyCardProps {
  // 1 nhà, hoặc mọi nhà của farm khi lọc tất cả nhà yến (số đếm cộng theo ngày)
  houseIds: string[];
  scopeLabel: string;
}

// Tỷ lệ chim về theo tuần của cả nhà yến
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
    datasets: [
      {
        label: t('chart.returnRate'),
        data: weeklyRates.map(week => Number(week.averageReturnRate.toFixed(1))),
        borderColor: SERIES_COLORS.entry,
        backgroundColor: SERIES_COLORS.entry,
        // Đường thẳng nối điểm, không tô vùng vì trục không bắt đầu từ 0
        tension: 0,
        borderWidth: 2,
        pointRadius: 4,
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        fill: false,
      },
      ...(averageRate === null ? [] : [{
        label: t('bird.average'),
        data: weeklyRates.map(() => Number(averageRate.toFixed(1))),
        borderColor: SERIES_COLORS.reference,
        backgroundColor: SERIES_COLORS.reference,
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
      }]),
    ],
  }), [weeklyRates, averageRate, t]);

  // Trục bám dải số đo (tròn chục, chừa 10 điểm) để thấy tuần nào lên xuống; đỉnh gợi ý 100
  const rateMin = weeklyRates.length === 0 ? 0 : Math.max(0, Math.floor((Math.min(...weeklyRates.map(week => week.averageReturnRate)) - 10) / 10) * 10);
  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, legend: LINE_LEGEND },
    scales: {
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...X_AXIS_TICKS } },
      y: { ...baseChartOptions.scales.y, min: rateMin, suggestedMax: 100, title: axisTitle('%') },
    },
  } as ChartOptions<'line'>), [rateMin]);

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
        <StatStrip
          items={[
            { label: t('bird.average'), value: averageRate === null ? NO_VALUE : num(averageRate, 1), unit: '%', sub: t('bird.averageSub', { n: num(countedDays) }) },
            { label: t('bird.latestWeek'), value: latestWeek ? num(latestWeek.averageReturnRate, 1) : NO_VALUE, unit: '%', sub: latestWeek ? t('bird.latestWeekSub', { date: date(latestWeek.weekStart) }) : NO_VALUE },
            { label: t('bird.change'), value: weekChange === null ? NO_VALUE : signedPoints(weekChange), sub: t('bird.changeSub') },
          ]}
        />

        {/* Cảnh báo giảm quá mức chuyên gia đặt riêng cho từng nhà nên chỉ hiện khi xem 1 nhà */}
        {single?.is_significant_drop && single.drop_percent !== null && (
          <p className="flex items-start gap-2 rounded-2xl border-2 border-orange-300 bg-orange-50 px-4 py-3 text-sm text-charcoal">
            <WarningIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-safetyOrange" aria-hidden="true" />
            {t('bird.drop', { drop: num(single.drop_percent, 1), threshold: num(single.drop_threshold_pct) })}
          </p>
        )}

        {weeklyRates.length > 0 ? (
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
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
