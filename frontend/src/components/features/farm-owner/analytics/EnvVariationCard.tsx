import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { Chart as ChartJSInstance, ChartOptions, Plugin } from 'chart.js'
import { Radio } from 'lucide-react'
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme'
import { useEnvSummary } from '@/hooks/farm-owner/useAnalytics'
import { Badge, Card } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { formatSensor } from '@/lib/helpers'
import { labelForRange, xAxisTicks } from '@/components/features/farm-owner/analytics/analytics.constants'
import RangeChips from '@/components/features/farm-owner/analytics/RangeChips'
import type { AnalyticsRange } from '@/apis/farm-owner/analytics.api'
import type { Thresholds } from '@/types'

/** Tô nền dải "lý tưởng" [min,max] trên trục Nhiệt độ (trái) — không cần thêm chartjs-plugin-annotation. */
function idealZonePlugin(min: number, max: number): Plugin<'line'> {
  return {
    id: 'idealZone',
    beforeDatasetsDraw(chart: ChartJSInstance<'line'>) {
      const { ctx, chartArea, scales } = chart
      const yScale = scales.y
      if (!chartArea || !yScale) return
      // getPixelForValue không tự cắt theo chartArea — khi ngưỡng nằm ngoài dải trục Y hiện tại
      // (VD nhiệt độ thực 20-23°C nhưng ngưỡng 26-31°C), yTop/yBottom lọt ra ngoài chartArea.top
      // và mảng màu tô đè lên legend/tiêu đề phía trên. Kẹp lại trước khi vẽ.
      const yTop = Math.max(chartArea.top, Math.min(yScale.getPixelForValue(max), chartArea.bottom))
      const yBottom = Math.min(chartArea.bottom, Math.max(yScale.getPixelForValue(min), chartArea.top))
      if (yBottom <= yTop) return
      ctx.save()
      ctx.fillStyle = 'rgba(181,211,44,0.10)'
      ctx.fillRect(chartArea.left, yTop, chartArea.right - chartArea.left, yBottom - yTop)
      ctx.restore()
    },
  }
}

/**
 * ANALYTICS-FR-001 — biểu đồ kép Nhiệt độ (trục trái) × Độ ẩm (trục phải) theo
 * khoảng thời gian, dữ liệu thật từ `/analytics/env/summary` (không fake — thay
 * thế EnvTab cũ, gộp cả 2 trục vào 1 card duy nhất). Badge NH3/CO2 + "LIVE" lấy
 * từ telemetry realtime qua socket (useTelemetry ở trang cha), không phải REST
 * bucket — nên tách props riêng khỏi phần lịch sử.
 */
export default function EnvVariationCard({
  zoneId, range, setRange, thresholds,
  live,
}: {
  zoneId: string
  range: AnalyticsRange
  setRange: (r: AnalyticsRange) => void
  thresholds?: Thresholds
  live: { isLive: boolean; nh3_ppm?: number; co2_ppm?: number }
}) {
  const { data, isLoading } = useEnvSummary(zoneId, range)

  const chartData = useMemo(() => ({
    labels: data?.series.map(p => labelForRange(p.timestamp, range)) ?? [],
    datasets: [
      {
        label: 'Nhiệt độ (°C)',
        data: data?.series.map(p => p.temperature ?? null) ?? [],
        borderColor: CHART_COLORS.climateOrange,
        backgroundColor: 'rgba(237,143,80,0.08)',
        yAxisID: 'y',
        fill: false, tension: 0.35, pointRadius: 0, borderWidth: 2, spanGaps: true,
      },
      {
        label: 'Độ ẩm (%)',
        data: data?.series.map(p => p.humidity ?? null) ?? [],
        borderColor: CHART_COLORS.accentGreen,
        backgroundColor: 'rgba(181,211,44,0.08)',
        yAxisID: 'y1',
        fill: false, tension: 0.35, pointRadius: 0, borderWidth: 2, spanGaps: true,
      },
    ],
  }), [data, range])

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, legend: { display: true, position: 'top' as const, labels: { boxWidth: 10, font: { family: 'Plus Jakarta Sans', size: 11 } } } },
    scales: {
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...xAxisTicks } },
      y: {
        ...baseChartOptions.scales.y,
        title: { display: true, text: '°C', color: CHART_COLORS.warmGray, font: { family: 'Plus Jakarta Sans', size: 11 } },
      },
      y1: {
        position: 'right' as const,
        grid: { display: false },
        ticks: { color: CHART_COLORS.warmGray, font: { family: 'Plus Jakarta Sans', size: 11 } },
        title: { display: true, text: '%', color: CHART_COLORS.warmGray, font: { family: 'Plus Jakarta Sans', size: 11 } },
      },
    },
  } as ChartOptions<'line'>), [])

  const plugins = useMemo(
    () => (thresholds ? [idealZonePlugin(thresholds.temp_min, thresholds.temp_max)] : []),
    [thresholds],
  )

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={live.isLive ? 'positive' : 'neutral'}>
              <Radio width={12} height={12} />
              {live.isLive ? 'LIVE' : 'Chưa realtime'}
            </Badge>
            <h2 className="text-h2 text-charcoal">Biến thiên vi khí hậu theo thời gian</h2>
          </div>
          <p className="mt-1 text-sm text-warmGray">
            Nhiệt độ (trục trái) và Độ ẩm (trục phải) — dữ liệu cảm biến RS485 qua MQTT, gộp theo khoảng thời gian đã chọn
          </p>
        </div>
        <RangeChips range={range} onChange={setRange} />
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-warmGray/15 px-3 py-1 text-xs font-medium text-charcoal">
          <span className="h-1.5 w-1.5 rounded-full bg-alertRed" />
          Khí độc NH3: {formatSensor(live.nh3_ppm, 'ppm', 2)}
          {thresholds && <span className="text-warmGray">(Cảnh giác &gt; {thresholds.nh3_max} ppm)</span>}
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-warmGray/15 px-3 py-1 text-xs font-medium text-charcoal">
          <span className="h-1.5 w-1.5 rounded-full bg-graphite" />
          Khí CO2: {formatSensor(live.co2_ppm, 'ppm', 0)}
          {thresholds && <span className="text-warmGray">(An toàn &lt; {thresholds.co2_max} ppm)</span>}
        </span>
        {thresholds && (
          <span className="rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-800">
            Vùng lý tưởng: {thresholds.temp_min}–{thresholds.temp_max}°C · {thresholds.humidity_min}–{thresholds.humidity_max}% RH
          </span>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-72 w-full" />
      ) : data && data.series.length > 0 ? (
        <div className="h-72">
          {/* react-chartjs-2 5.3.1 chỉ đọc prop `plugins` một lần lúc `new Chart(...)` (dist/index.js:79-90)
              — nếu thresholds về sau khi chart đã mount (hoặc đổi ở nơi khác), dải "vùng lý tưởng" sẽ
              không bao giờ cập nhật. Ép remount bằng key đổi theo min/max để plugin luôn khớp ngưỡng mới. */}
          <Line key={`${thresholds?.temp_min ?? '_'}-${thresholds?.temp_max ?? '_'}`} data={chartData} options={chartOptions} plugins={plugins} />
        </div>
      ) : (
        <div className="flex h-72 items-center justify-center text-sm text-warmGray">Chưa có dữ liệu trong khoảng thời gian này</div>
      )}
    </Card>
  )
}
