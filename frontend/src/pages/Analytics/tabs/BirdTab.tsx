import { useState, useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { format, parseISO } from 'date-fns'
import { CHART_COLORS, baseChartOptions } from '@/utils/chartTheme'
import { useBirdCountTrends } from '@/hooks/useAnalytics'
import { Card } from '@/components/ui'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { cn } from '@/utils/cn'
import { formatReturnRate } from '@/utils/helpers'
import { xAxisTicks } from '../constants'
import StatChip from '../components/StatChip'

const DAY_OPTIONS = [{ value: 7, label: '7 ngày' }, { value: 30, label: '30 ngày' }] as const

function BirdRangeToggle({ days, onChange }: { days: number; onChange: (d: 7 | 30) => void }) {
  return (
    <div className="flex gap-1 rounded-2xl bg-warmGray/10 p-1">
      {DAY_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-xl px-4 py-1.5 text-sm font-semibold transition-colors',
            days === opt.value ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function BirdTab({ zoneId }: { zoneId: string }) {
  const [days, setDays] = useState<7 | 30>(30)
  const { data, isLoading } = useBirdCountTrends(zoneId, days)

  const chartData = useMemo(() => ({
    labels: data?.records.map(r => format(parseISO(r.date), 'dd/MM')) ?? [],
    datasets: [{
      label: 'Return rate',
      data: data?.records.map(r => r.return_rate) ?? [],
      borderColor: CHART_COLORS.charcoal,
      backgroundColor: 'rgba(39,35,31,0.06)',
      fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2, spanGaps: true,
    }],
  }), [data])

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    scales: { x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...xAxisTicks } }, y: baseChartOptions.scales.y },
  } as ChartOptions<'line'>), [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <BirdRangeToggle days={days} onChange={setDays} />
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-72 w-full" />
      ) : !data || data.records.length === 0 ? (
        <EmptyState
          title="Chưa có dữ liệu đếm chim"
          description="Cần module VISION (Camera AI đếm chim, Raspberry Pi) hoạt động để có dữ liệu return rate."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatChip label="TB Return Rate" value={data.avg_return_rate !== null ? formatReturnRate(data.avg_return_rate) : '--'} />
            <StatChip label="Mới nhất" value={data.latest_return_rate !== null ? formatReturnRate(data.latest_return_rate) : '--'} />
            <StatChip
              label="Thay đổi"
              value={data.drop_percent !== null ? `${data.drop_percent > 0 ? '-' : '+'}${Math.abs(data.drop_percent).toFixed(1)}%` : '--'}
              warn={data.is_significant_drop}
            />
          </div>
          <Card size="lg">
            <div className="h-72">
              <Line data={chartData} options={chartOptions} />
            </div>
          </Card>
          {data.is_significant_drop && (
            <p className="rounded-xl bg-alertRed/10 px-3 py-2.5 text-sm font-medium text-alertRed">
              Return rate giảm hơn 20% so với trung bình — cân nhắc kiểm tra thiên địch hoặc sự cố hạ tầng (VISION-FR-011).
            </p>
          )}
        </>
      )}
    </div>
  )
}
