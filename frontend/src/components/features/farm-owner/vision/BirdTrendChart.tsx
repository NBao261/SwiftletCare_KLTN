import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { format, parseISO } from 'date-fns'
import { Card } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme'
import { useBirdCountTrends } from '@/hooks/farm-owner/useAnalytics'
import { xAxisTicks } from '@/components/features/farm-owner/analytics/analytics.constants'
import { cn } from '@/lib/cn'

const DAY_OPTIONS = [7, 14, 30] as const
type DayOption = (typeof DAY_OPTIONS)[number]

interface BirdTrendChartProps {
  zoneId: string
}

// BirdTrendChart – Entry vs Exit theo ngày — API thật (GET /analytics/bird-count/trends)
export default function BirdTrendChart({ zoneId }: BirdTrendChartProps) {
  const [days, setDays] = useState<DayOption>(7)
  const { data, isLoading } = useBirdCountTrends(zoneId, days)

  const chartData = useMemo(() => {
    const records = data?.records ?? []
    return {
      labels: records.map(r => format(parseISO(r.date), 'dd/MM')),
      datasets: [
        {
          label: 'Vào tổ',
          data: records.map(r => r.evening_entry),
          borderColor: CHART_COLORS.accentGreen,
          backgroundColor: 'rgba(181,211,44,0.12)',
          fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2,
        },
        {
          label: 'Xuất đàn',
          data: records.map(r => r.morning_exit),
          borderColor: CHART_COLORS.climateOrange,
          backgroundColor: 'rgba(237,143,80,0.1)',
          fill: true, tension: 0.35, pointRadius: 2, borderWidth: 2,
        },
      ],
    }
  }, [data])

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: {
      ...baseChartOptions.plugins,
      legend: { display: true, position: 'top' as const, labels: { boxWidth: 10, font: { family: 'Plus Jakarta Sans', size: 11 } } },
    },
    scales: {
      x: { ...baseChartOptions.scales.x, ticks: { ...baseChartOptions.scales.x.ticks, ...xAxisTicks } },
      y: baseChartOptions.scales.y,
    },
  } as ChartOptions<'line'>), [])

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-h2 text-charcoal">Xu hướng đếm chim {days} ngày</h2>
          <p className="mt-1 text-sm text-warmGray">Số lượt vào tổ và xuất đàn theo ngày</p>
        </div>
        <div className="flex gap-1 rounded-2xl bg-warmGray/10 p-1">
          {DAY_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors',
                days === d ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
              )}
            >
              {d} Ngày
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-72 w-full" />
      ) : (
        <div className="h-72">
          <Line data={chartData} options={chartOptions} />
        </div>
      )}
    </Card>
  )
}
