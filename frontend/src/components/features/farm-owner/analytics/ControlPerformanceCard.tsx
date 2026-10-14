import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import type { Chart as ChartJSInstance, ChartOptions, Plugin } from 'chart.js'
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme'
import { useControlPerformance } from '@/hooks/farm-owner/useAnalytics'
import { Button, Card } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { labelForRange, xAxisTicks } from '@/components/features/farm-owner/analytics/analytics.constants'
import RangeChips from '@/components/features/farm-owner/analytics/RangeChips'
import StatChip from '@/components/features/farm-owner/analytics/StatChip'
import FuzzyTuningModal from '@/components/features/farm-owner/analytics/FuzzyTuningModal'
import type { AnalyticsRange } from '@/apis/farm-owner/analytics.api'

/** Vạch dọc nét đứt tại các bucket có lần chỉnh hệ số — để so hành vi trước/sau khi chỉnh. */
function tuningMarkersPlugin(indices: number[]): Plugin<'line'> {
  return {
    id: 'tuningMarkers',
    afterDatasetsDraw(chart: ChartJSInstance<'line'>) {
      const { ctx, chartArea, scales } = chart
      if (!chartArea || !scales.x) return
      ctx.save()
      ctx.strokeStyle = CHART_COLORS.alertRed
      ctx.fillStyle = CHART_COLORS.alertRed
      ctx.setLineDash([4, 4])
      ctx.font = '10px "Plus Jakarta Sans", sans-serif'
      for (const i of indices) {
        const x = scales.x.getPixelForValue(i)
        ctx.beginPath()
        ctx.moveTo(x, chartArea.top)
        ctx.lineTo(x, chartArea.bottom)
        ctx.stroke()
        ctx.fillText('Chỉnh hệ số', x + 4, chartArea.top + 10)
      }
      ctx.restore()
    },
  }
}

const fmt = (v: number | null | undefined, unit: string) => (v === null || v === undefined ? '--' : `${v}${unit}`)

/**
 * ANALYTICS-FR-008 — "Hiệu quả điều khiển": độ ẩm thật × % phun sương/quạt do bộ
 * điều khiển mờ trên ESP32 quyết định, % thời gian nằm trong ngưỡng, số lần relay
 * đóng cắt/giờ. Người vận hành nhìn đây rồi chỉnh 4 hệ số (ENV-FR-021) — hệ thống
 * thu thập + đo, con người quyết định. Chỉ có dữ liệu từ firmware ≥ 1.1.0.
 */
export default function ControlPerformanceCard({ zoneId, zoneName }: { zoneId: string; zoneName: string }) {
  const [range, setRange] = useState<AnalyticsRange>('24h')
  const [editing, setEditing] = useState(false)
  const { data, isLoading } = useControlPerformance(zoneId, range)

  const chartData = useMemo(() => ({
    labels: data?.series.map(p => labelForRange(p.timestamp, range)) ?? [],
    datasets: [
      {
        label: 'Độ ẩm (%RH)',
        data: data?.series.map(p => p.humidity ?? null) ?? [],
        borderColor: CHART_COLORS.accentGreen,
        yAxisID: 'y', tension: 0.35, pointRadius: 0, borderWidth: 2, spanGaps: true,
      },
      {
        label: 'Phun sương (%)',
        data: data?.series.map(p => p.misting_pct ?? null) ?? [],
        borderColor: CHART_COLORS.charcoal,
        yAxisID: 'y1', tension: 0.35, pointRadius: 0, borderWidth: 2, spanGaps: true,
      },
      {
        label: 'Quạt (%)',
        data: data?.series.map(p => p.ventilation_pct ?? null) ?? [],
        borderColor: CHART_COLORS.climateOrange,
        borderDash: [6, 4],
        yAxisID: 'y1', tension: 0.35, pointRadius: 0, borderWidth: 2, spanGaps: true,
      },
    ],
  }), [data, range])

  const chartOptions = useMemo(() => {
    const axisFont = { family: 'Plus Jakarta Sans', size: 11 }
    return {
      ...baseChartOptions,
      plugins: { ...baseChartOptions.plugins, legend: { display: true, position: 'top' as const, labels: { boxWidth: 10, font: axisFont } } },
      scales: {
        x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...xAxisTicks } },
        y: { ...baseChartOptions.scales.y, title: { display: true, text: '%RH', color: CHART_COLORS.warmGray, font: axisFont } },
        y1: {
          position: 'right' as const, min: 0, max: 100,
          grid: { display: false },
          ticks: { color: CHART_COLORS.warmGray, font: axisFont },
          title: { display: true, text: '% công suất', color: CHART_COLORS.warmGray, font: axisFont },
        },
      },
    } as ChartOptions<'line'>
  }, [])

  // Mỗi lần chỉnh → bucket đầu tiên từ thời điểm đó trở đi
  const markerIndices = useMemo(() => {
    if (!data) return []
    return data.tuning_changes
      .map(c => data.series.findIndex(p => p.timestamp >= c.changed_at))
      .filter(i => i >= 0)
  }, [data])
  const plugins = useMemo(() => [tuningMarkersPlugin(markerIndices)], [markerIndices])

  const stats = data?.stats
  const tuning = data?.fuzzy_tuning

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h2 text-charcoal">Hiệu quả điều khiển (logic mờ)</h2>
          <p className="mt-1 text-sm text-warmGray">
            Độ ẩm thực tế (trục trái) so với % phun sương/quạt do ESP32 quyết định (trục phải) — vạch đỏ là lúc chỉnh hệ số
          </p>
        </div>
        <RangeChips range={range} onChange={setRange} />
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-72 w-full" />
      ) : !data || !stats ? (
        <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-warmGray">
          Chưa có dữ liệu điều khiển mờ trong khoảng này — cần thiết bị chạy firmware ≥ 1.1.0 và đang gửi telemetry.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatChip label={`Độ ẩm trong ngưỡng (${data.thresholds.humidity_min}–${data.thresholds.humidity_max}%)`} value={fmt(stats.humidityInRangePct, '%')} />
            <StatChip label={`Nhiệt độ trong ngưỡng (${data.thresholds.temp_min}–${data.thresholds.temp_max}°C)`} value={fmt(stats.temperatureInRangePct, '%')} />
            <StatChip label={`Phun sương · TB ${fmt(stats.mistingAvgPct, '%')}`} value={fmt(stats.mistingSwitchesPerHour, ' lần/giờ')} />
            <StatChip label={`Quạt · TB ${fmt(stats.ventilationAvgPct, '%')}`} value={fmt(stats.ventilationSwitchesPerHour, ' lần/giờ')} />
          </div>
          <div className="h-72">
            {/* react-chartjs-2 chỉ đọc prop `plugins` lúc tạo chart — remount khi vạch mốc đổi */}
            <Line key={markerIndices.join(',')} data={chartData} options={chartOptions} plugins={plugins} />
          </div>
        </>
      )}

      {data && data.relay_usage.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-warmGray/15 pt-4">
          <p className="label-caption">Tới mốc bảo trì theo thời gian chạy (từ lần bảo trì trước)</p>
          {data.relay_usage.map(u => (
            <p key={u.device_id} className="text-xs text-charcoal">
              {u.device_id} · Bơm {u.misting.hours}/{data.service_limits.misting.hours} giờ,{' '}
              {u.misting.switches.toLocaleString('vi-VN')}/{data.service_limits.misting.switches.toLocaleString('vi-VN')} lần ·
              Quạt {u.ventilation.hours}/{data.service_limits.ventilation.hours} giờ,{' '}
              {u.ventilation.switches.toLocaleString('vi-VN')}/{data.service_limits.ventilation.switches.toLocaleString('vi-VN')} lần
            </p>
          ))}
        </div>
      )}

      {tuning && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-warmGray/15 pt-4">
          <p className="text-xs text-warmGray">
            Hệ số hiện tại: vùng ẩm {tuning.fuzzy_humidity_band}%RH · vùng nóng {tuning.fuzzy_temp_band}°C ·
            quạt khi khô {tuning.fuzzy_fan_dry_level}% · chu kỳ {tuning.fuzzy_window_sec}s ·
            lọc nhiễu {tuning.fuzzy_input_filter === false ? 'tắt' : 'bật'}
            {stats ? ` · ${stats.sampleCount} mẫu` : ''}
          </p>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Chỉnh hệ số</Button>
        </div>
      )}

      {editing && tuning && (
        <FuzzyTuningModal zoneId={zoneId} zoneName={zoneName} current={tuning} onClose={() => setEditing(false)} />
      )}
    </Card>
  )
}
