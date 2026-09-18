import { useState, useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { CHART_COLORS, CHART_PALETTE, baseChartOptions } from '@/utils/chartTheme'
import { useFarmZones } from '@/hooks/useFarms'
import { useEnvCompare } from '@/hooks/useAnalytics'
import { Card } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { cn } from '@/utils/cn'
import { METRICS, type MetricKey } from '../constants'
import MetricTabs from '../components/MetricTabs'
import RangeChips from '../components/RangeChips'
import type { AnalyticsRange } from '@/services/api/analytics'

export default function CompareTab({
  farmId, range, setRange, metric, setMetric,
}: { farmId: string | undefined; range: AnalyticsRange; setRange: (r: AnalyticsRange) => void; metric: MetricKey; setMetric: (m: MetricKey) => void }) {
  const { data: zones } = useFarmZones(farmId)
  const [selected, setSelected] = useState<string[]>([])
  const { data, isLoading } = useEnvCompare(selected, range)
  const metricDef = METRICS.find(m => m.key === metric)!

  function toggle(zoneId: string) {
    setSelected(s => (s.includes(zoneId) ? s.filter(z => z !== zoneId) : s.length < 6 ? [...s, zoneId] : s))
  }

  const barData = useMemo(() => ({
    labels: data?.zones.map(z => z.zoneName) ?? [],
    datasets: [{
      label: metricDef.label,
      data: data?.zones.map(z => (metric === 'sound_db' ? null : z.metrics?.[metric] ?? null)) ?? [],
      backgroundColor: (data?.zones ?? []).map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]),
      borderRadius: 8,
    }],
  }), [data, metric, metricDef.label])

  const barOptions = useMemo(() => ({
    ...baseChartOptions,
    scales: {
      x: { ...baseChartOptions.scales.x },
      y: { ...baseChartOptions.scales.y, title: { display: true, text: metricDef.unit, color: CHART_COLORS.warmGray, font: { family: 'Inter', size: 11 } } },
    },
  } as ChartOptions<'bar'>), [metricDef.unit])

  if (!farmId) {
    return (
      <EmptyState
        title="Chưa xác định trang trại"
        description="Chọn 1 zone ở thanh trên cùng trước — hệ thống dùng trang trại của zone đó để gợi ý danh sách so sánh."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MetricTabs metric={metric} onChange={setMetric} />
        <RangeChips range={range} onChange={setRange} />
      </div>

      <Card>
        <p className="label-caption mb-3">Chọn tối đa 6 zone để so sánh</p>
        <div className="flex flex-wrap gap-2">
          {zones?.map(zone => (
            <label
              key={zone._id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                selected.includes(zone._id) ? 'border-charcoal bg-charcoal text-white' : 'border-warmGray/20 text-charcoal hover:bg-warmGray/10',
              )}
            >
              <input type="checkbox" className="hidden" checked={selected.includes(zone._id)} onChange={() => toggle(zone._id)} />
              {zone.houseName} / {zone.name}
            </label>
          ))}
          {zones?.length === 0 && <p className="text-sm text-warmGray">Trang trại này chưa có zone nào.</p>}
        </div>
      </Card>

      {selected.length === 0 ? (
        <EmptyState title="Chưa chọn zone nào" description="Chọn ít nhất 1 zone ở trên để vẽ biểu đồ so sánh." />
      ) : isLoading ? (
        <LoadingSkeleton className="h-72 w-full" />
      ) : metric === 'sound_db' ? (
        <EmptyState title="Chưa hỗ trợ so sánh Âm thanh" description="API so sánh đa Zone hiện chỉ gồm nhiệt độ, độ ẩm, ánh sáng, NH3, CO2." />
      ) : (
        <Card size="lg">
          <div className="h-72">
            <Bar data={barData} options={barOptions} />
          </div>
        </Card>
      )}
    </div>
  )
}
