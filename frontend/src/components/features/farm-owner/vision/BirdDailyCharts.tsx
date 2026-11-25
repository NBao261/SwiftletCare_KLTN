import { useMemo, useState, type ReactNode } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { format, parseISO } from 'date-fns'
import { Card, ChartEmptyFrame } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { X_AXIS_TICKS, CHART_FONT, CHART_LEGEND } from '@/components/features/farm-owner/analytics/analytics.constants'
import { birdFlowDict } from '@/constants/birdFlow.i18n'
import { NO_VALUE } from '@/constants/display'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useHousesBirdCountTrends } from '@/hooks/farm-owner/useAnalytics'
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme'
import { cn } from '@/lib/cn'

const DAY_OPTIONS = [7, 14, 30] as const
type DayOption = (typeof DAY_OPTIONS)[number]
const CHART_HEIGHT = 'h-64'
// Cột mảnh, đầu cột bo 4px, hai cột cùng ngày có khe hở
const MAX_BAR_THICKNESS = 24
const BAR_RADIUS = { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }

// Màu theo việc: cam = chim ra buổi sáng, ô-liu = chim về buổi chiều (cặp đã qua kiểm tra mù màu)
const X_AXIS = { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...X_AXIS_TICKS } }
const LEGEND = { ...CHART_LEGEND, labels: { ...CHART_LEGEND.labels, font: CHART_FONT } }

const EXIT_COLOR = CHART_COLORS.climateOrange
const ENTRY_COLOR = CHART_COLORS.accentOlive

// Hai biểu đồ theo ngày: số chim ra và về, tỷ lệ chim về; kèm bảng số liệu để đọc đúng từng giá trị
export default function BirdDailyCharts({ houseIds }: { houseIds: string[] }) {
  const { t, num } = useTranslation(birdFlowDict)
  const [days, setDays] = useState<DayOption>(7)
  const { records, single, isLoading } = useHousesBirdCountTrends(houseIds, days)

  const model = useMemo(() => {
    const labels = records.map(record => format(parseISO(record.date), 'dd/MM'))
    // Buổi nào thiếu số đếm thì không vẽ cột, để không đọc nhầm thành 0 con
    const exits = records.map(record => (record.has_morning === false ? null : record.morning_exit))
    const entries = records.map(record => (record.has_evening === false ? null : record.evening_entry))
    const rates = records.map(record => record.return_rate)
    const known = rates.flatMap(rate => (rate === null ? [] : [rate]))
    const average = single?.avg_return_rate ?? (known.length > 0 ? known.reduce((sum, rate) => sum + rate, 0) / known.length : null)
    // Trục tỷ lệ bám dải số đo (tròn chục, chừa 10 điểm) để thấy đường lên xuống; không dưới 0, đỉnh gợi ý 100
    const lowest = Math.min(...known, ...(average === null ? [] : [average]))
    const rateMin = Number.isFinite(lowest) ? Math.max(0, Math.floor((lowest - 10) / 10) * 10) : 0
    const hasMissing = records.some(record => record.has_morning === false || record.has_evening === false)
    return { labels, exits, entries, rates, average, rateMin, hasMissing }
  }, [records, single])

  const countData = useMemo(() => ({
    labels: model.labels,
    datasets: [
      { label: t('today.exit'), data: model.exits, backgroundColor: EXIT_COLOR, borderRadius: BAR_RADIUS, borderSkipped: false as const, maxBarThickness: MAX_BAR_THICKNESS },
      { label: t('today.entry'), data: model.entries, backgroundColor: ENTRY_COLOR, borderRadius: BAR_RADIUS, borderSkipped: false as const, maxBarThickness: MAX_BAR_THICKNESS },
    ],
  }), [model, t])

  const rateData = useMemo(() => ({
    labels: model.labels,
    datasets: [
      {
        label: t('today.rate'),
        data: model.rates,
        borderColor: ENTRY_COLOR,
        // Trục không bắt đầu từ 0 nên không tô vùng dưới đường
        fill: false,
        // Đường thẳng nối điểm: đường cong vẽ đỉnh không có trong số đếm; ngày thiếu số thì đứt đường
        tension: 0,
        spanGaps: false,
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: ENTRY_COLOR,
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
      },
      ...(model.average === null ? [] : [{
        label: t('daily.average'),
        data: model.labels.map(() => model.average),
        borderColor: CHART_COLORS.warmGray,
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
      }]),
    ],
  }), [model, t])

  const countOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: {
      ...baseChartOptions.plugins,
      legend: LEGEND,
      tooltip: {
        ...baseChartOptions.plugins.tooltip,
        callbacks: { label: context => t('daily.tooltipCount', { label: context.dataset.label ?? '', value: num(context.parsed.y ?? 0) }) },
      },
    },
    scales: {
      x: X_AXIS,
      // Số chim là số nguyên, không âm: trục bắt đầu ở 0
      y: { ...baseChartOptions.scales.y, min: 0, ticks: { ...baseChartOptions.scales.y.ticks, precision: 0 } },
    },
  } as ChartOptions<'bar'>), [t, num])

  const rateOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: {
      ...baseChartOptions.plugins,
      legend: LEGEND,
      tooltip: {
        ...baseChartOptions.plugins.tooltip,
        callbacks: { label: context => t('daily.tooltipRate', { label: context.dataset.label ?? '', value: num(context.parsed.y ?? 0, 1) }) },
      },
    },
    scales: {
      x: X_AXIS,
      y: { ...baseChartOptions.scales.y, min: model.rateMin, suggestedMax: 100, ticks: { ...baseChartOptions.scales.y.ticks, callback: (value: number | string) => `${value}%` } },
    },
  } as ChartOptions<'line'>), [t, num, model.rateMin])

  const isEmpty = records.length === 0

  return (
    <section aria-label={t('daily.title')} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h2 text-charcoal">{t('daily.title')}</h2>
        <div role="group" aria-label={t('daily.title')} className="flex gap-1 rounded-2xl bg-warmGray/10 p-1">
          {DAY_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              aria-pressed={days === option}
              onClick={() => setDays(option)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors max-sm:min-h-11',
                days === option ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
              )}
            >
              {t('daily.days', { n: option })}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard title={t('daily.countsTitle')} subtitle={t('daily.countsSub')}>
          {isLoading ? <LoadingSkeleton className={cn(CHART_HEIGHT, 'w-full')} />
            : isEmpty ? <ChartEmptyFrame message={t('daily.empty')} className={CHART_HEIGHT} />
              : <div className={CHART_HEIGHT}><Bar data={countData} options={countOptions} /></div>}
        </ChartCard>
        <ChartCard title={t('daily.rateTitle')} subtitle={t('daily.rateSub')}>
          {isLoading ? <LoadingSkeleton className={cn(CHART_HEIGHT, 'w-full')} />
            : isEmpty ? <ChartEmptyFrame message={t('daily.empty')} className={CHART_HEIGHT} />
              : <div className={CHART_HEIGHT}><Line data={rateData} options={rateOptions} /></div>}
        </ChartCard>
      </div>

      {model.hasMissing && <p className="text-small text-warmGray">{t('daily.missingNote')}</p>}

      {!isEmpty && (
        <details className="group rounded-2xl border border-warmGray/15 bg-white shadow-card">
          <summary className="cursor-pointer select-none px-5 py-3 text-sm font-semibold text-charcoal">{t('daily.table')}</summary>
          <div className="overflow-x-auto px-5 pb-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-warmGray/15 text-small text-warmGray">
                  <th className="py-2 pr-4 font-semibold">{t('daily.colDate')}</th>
                  <th className="py-2 pr-4 text-right font-semibold">{t('today.exit')}</th>
                  <th className="py-2 pr-4 text-right font-semibold">{t('today.entry')}</th>
                  <th className="py-2 pr-4 text-right font-semibold">{t('today.rate')}</th>
                  <th className="py-2 font-semibold">{t('daily.colNote')}</th>
                </tr>
              </thead>
              <tbody>
                {[...records].reverse().map(record => (
                  <tr key={record.date} className="border-b border-warmGray/10 last:border-0">
                    <td className="py-2 pr-4 tabular-nums text-charcoal">{format(parseISO(record.date), 'dd/MM/yyyy')}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-charcoal">{record.has_morning === false ? NO_VALUE : num(record.morning_exit)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-charcoal">{record.has_evening === false ? NO_VALUE : num(record.evening_entry)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-charcoal">{record.return_rate === null ? NO_VALUE : `${num(record.return_rate, 1)} %`}</td>
                    <td className="py-2 text-small text-warmGray">
                      {[record.has_morning === false && t('daily.noteMorning'), record.has_evening === false && t('daily.noteEvening')].filter(Boolean).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div>
        <h3 className="text-h3 text-charcoal">{title}</h3>
        <p className="mt-1 text-sm text-warmGray">{subtitle}</p>
      </div>
      {children}
    </Card>
  )
}
