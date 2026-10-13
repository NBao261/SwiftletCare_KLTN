import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { format, parseISO } from 'date-fns'
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme'
import { useForecast } from '@/hooks/farm-owner/useAnalytics'
import { Card } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { xAxisTicks } from '@/components/features/farm-owner/analytics/analytics.constants'
import StatChip from '@/components/features/farm-owner/analytics/StatChip'
import type { MetricForecast } from '@/apis/farm-owner/analytics.api'

const LABEL = { humidity: 'Độ ẩm', temperature: 'Nhiệt độ' } as const
const UNIT = { humidity: '%', temperature: '°C' } as const
const mae = (v: number | null | undefined, unit: string) => (v === null || v === undefined ? '--' : `±${Math.round(v * 10) / 10}${unit}`)

/** Tách 1 chuỗi thành 2 dataset: lịch sử (liền) và dự báo (nét đứt, nối từ điểm thật cuối cùng) */
function split(fc: MetricForecast | null, labels: string[]) {
  const byTime = new Map<string, number>()
  fc?.history.forEach(p => byTime.set(p.timestamp, p.value))
  const forecastByTime = new Map<string, number>()
  fc?.forecast.forEach(p => forecastByTime.set(p.timestamp, p.value))
  const lastHistory = fc?.history[fc.history.length - 1]
  if (lastHistory) forecastByTime.set(lastHistory.timestamp, lastHistory.value)
  return {
    history: labels.map(t => byTime.get(t) ?? null),
    forecast: labels.map(t => forecastByTime.get(t) ?? null),
  }
}

/**
 * ANALYTICS-FR-009 — dự báo độ ẩm/nhiệt độ 60 phút tới (Holt trend tắt dần trên
 * dữ liệu 6 giờ, gom 5 phút). Sai số là MAE đánh giá lùi trên chính dữ liệu đã
 * qua — hiện kèm để người xem biết dự báo tin được tới đâu. Cảnh báo sớm
 * FORECAST_BREACH (mức LOW) do job backend sinh, card này chỉ hiển thị.
 */
export default function ForecastCard({ zoneId }: { zoneId: string }) {
  const { data, isLoading } = useForecast(zoneId)

  const labels = useMemo(() => {
    const times = new Set<string>()
    for (const fc of [data?.humidity, data?.temperature]) {
      fc?.history.forEach(p => times.add(p.timestamp))
      fc?.forecast.forEach(p => times.add(p.timestamp))
    }
    return [...times].sort()
  }, [data])

  const chartData = useMemo(() => {
    const h = split(data?.humidity ?? null, labels)
    const t = split(data?.temperature ?? null, labels)
    const line = { tension: 0.35, pointRadius: 0, borderWidth: 2, spanGaps: true }
    return {
      labels: labels.map(ts => format(parseISO(ts), 'HH:mm')),
      datasets: [
        { label: 'Độ ẩm (%)', data: h.history, borderColor: CHART_COLORS.accentGreen, yAxisID: 'y', ...line },
        { label: 'Độ ẩm dự báo', data: h.forecast, borderColor: CHART_COLORS.accentGreen, borderDash: [6, 4], yAxisID: 'y', ...line },
        { label: 'Nhiệt độ (°C)', data: t.history, borderColor: CHART_COLORS.climateOrange, yAxisID: 'y1', ...line },
        { label: 'Nhiệt độ dự báo', data: t.forecast, borderColor: CHART_COLORS.climateOrange, borderDash: [6, 4], yAxisID: 'y1', ...line },
      ],
    }
  }, [data, labels])

  const chartOptions = useMemo(() => {
    const axisFont = { family: 'Plus Jakarta Sans', size: 11 }
    return {
      ...baseChartOptions,
      plugins: { ...baseChartOptions.plugins, legend: { display: true, position: 'top' as const, labels: { boxWidth: 10, font: axisFont } } },
      scales: {
        x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...xAxisTicks } },
        y: { ...baseChartOptions.scales.y, title: { display: true, text: '%RH', color: CHART_COLORS.warmGray, font: axisFont } },
        y1: {
          position: 'right' as const,
          grid: { display: false },
          ticks: { color: CHART_COLORS.warmGray, font: axisFont },
          title: { display: true, text: '°C', color: CHART_COLORS.warmGray, font: axisFont },
        },
      },
    } as ChartOptions<'line'>
  }, [])

  const hasData = !!(data?.humidity || data?.temperature)
  const p = data?.predicted

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2 text-charcoal">Dự báo 60 phút tới</h2>
        <p className="mt-1 text-sm text-warmGray">
          Nét liền: dữ liệu 6 giờ qua (gom 5 phút) · Nét đứt: dự báo — cảnh báo sớm trước khi độ ẩm/nhiệt độ vượt ngưỡng
        </p>
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-64 w-full" />
      ) : !hasData ? (
        <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-warmGray">
          Chưa đủ dữ liệu để dự báo — cần ít nhất 2 giờ dữ liệu liên tục và thiết bị còn gửi trong 15 phút gần nhất.
        </div>
      ) : (
        <>
          {p ? (
            <p className="rounded-2xl border border-climateOrange/30 bg-climateOrange/5 px-4 py-3 text-sm text-charcoal">
              {LABEL[p.metric]} có thể {p.direction === 'above' ? 'lên' : 'xuống'} <b>{p.value}{UNIT[p.metric]}</b> trong khoảng{' '}
              <b>{p.minutesAhead} phút</b> nữa (ngưỡng {p.limit}{UNIT[p.metric]}).
            </p>
          ) : (
            <p className="text-sm text-warmGray">Không có chỉ số nào được dự báo vượt ngưỡng trong 60 phút tới.</p>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatChip label="Sai số độ ẩm · 30 phút" value={mae(data?.humidity?.mae30, '%')} />
            <StatChip label="Sai số độ ẩm · 60 phút" value={mae(data?.humidity?.mae60, '%')} />
            <StatChip label="Sai số nhiệt độ · 30 phút" value={mae(data?.temperature?.mae30, '°C')} />
            <StatChip label="Sai số nhiệt độ · 60 phút" value={mae(data?.temperature?.mae60, '°C')} />
          </div>
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
          </div>
        </>
      )}
    </Card>
  )
}
