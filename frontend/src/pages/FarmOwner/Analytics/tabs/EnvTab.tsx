import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { CHART_COLORS, baseChartOptions } from '@/utils/chartTheme'
import { useEnvSummary } from '@/hooks/useAnalytics'
import { Card } from '@/components/ui'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { formatSensor } from '@/utils/helpers'
import { METRICS, type MetricKey, labelForRange, seriesStats, xAxisTicks } from '../constants'
import MetricTabs from '../components/MetricTabs'
import RangeChips from '../components/RangeChips'
import StatChip from '../components/StatChip'
import type { AnalyticsRange } from '@/services/api/analytics'

export default function EnvTab({
  zoneId, range, setRange, metric, setMetric,
}: { zoneId: string; range: AnalyticsRange; setRange: (r: AnalyticsRange) => void; metric: MetricKey; setMetric: (m: MetricKey) => void }) {
  const { data, isLoading } = useEnvSummary(zoneId, range)
  const metricDef = METRICS.find(m => m.key === metric)!
  const stats = data ? seriesStats(data.series, metric) : null

  const chartData = useMemo(() => ({
    labels: data?.series.map(p => labelForRange(p.timestamp, range)) ?? [],
    datasets: [{
      label: metricDef.label,
      data: data?.series.map(p => p[metric] ?? null) ?? [],
      borderColor: CHART_COLORS.charcoal,
      backgroundColor: 'rgba(39,35,31,0.06)',
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      borderWidth: 2,
      spanGaps: true,
    }],
  }), [data, range, metric, metricDef.label])

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    scales: {
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...xAxisTicks } },
      y: { ...baseChartOptions.scales.y, title: { display: true, text: metricDef.unit, color: CHART_COLORS.warmGray, font: { family: 'Inter', size: 11 } } },
    },
  } as ChartOptions<'line'>), [metricDef.unit])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetricTabs metric={metric} onChange={setMetric} />
        <RangeChips range={range} onChange={setRange} />
      </div>

      <Card size="lg">
        {isLoading ? (
          <LoadingSkeleton className="h-72 w-full" />
        ) : data && data.series.length > 0 ? (
          <div className="h-72">
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center text-sm text-warmGray">Chưa có dữ liệu trong khoảng thời gian này</div>
        )}
      </Card>

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <StatChip label="Thấp nhất" value={formatSensor(stats.min, metricDef.unit)} />
          <StatChip label="Trung bình" value={formatSensor(stats.avg, metricDef.unit)} />
          <StatChip label="Cao nhất" value={formatSensor(stats.max, metricDef.unit)} />
        </div>
      )}
    </div>
  )
}
