import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { Card } from '@/components/ui'
import EmptyState from '@/components/ui/EmptyState'
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme'
import type { HarvestBatch } from '@/types'

const MONTH_LABELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']

interface HarvestYearChartProps {
  batches: HarvestBatch[]
}

/** HarvestYearChart – sản lượng (kg) theo tháng trong năm hiện tại, tính từ Harvest Batch thật */
export default function HarvestYearChart({ batches }: HarvestYearChartProps) {
  const year = new Date().getFullYear()

  const monthlyKg = useMemo(() => {
    const totals = new Array(12).fill(0)
    for (const b of batches) {
      const d = new Date(b.harvest_date)
      if (d.getFullYear() === year) totals[d.getMonth()] += b.weight_grams / 1000
    }
    return totals.map(kg => +kg.toFixed(2))
  }, [batches, year])

  const hasData = monthlyKg.some(kg => kg > 0)

  const chartData = useMemo(() => ({
    labels: MONTH_LABELS,
    datasets: [{
      label: 'Sản lượng (kg)',
      data: monthlyKg,
      backgroundColor: CHART_COLORS.climateOrange,
      borderRadius: 6,
      maxBarThickness: 36,
    }],
  }), [monthlyKg])

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, legend: { display: false } },
  } as ChartOptions<'bar'>), [])

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2 text-charcoal">Sản lượng theo tháng {year}</h2>
        <p className="mt-1 text-sm text-warmGray">Tổng khối lượng (kg) các đợt thu hoạch mỗi tháng</p>
      </div>

      {hasData ? (
        <div className="h-72">
          <Bar data={chartData} options={chartOptions} />
        </div>
      ) : (
        <EmptyState
          title="Chưa có dữ liệu năm nay"
          description="Ghi nhận đợt thu hoạch đầu tiên của năm để biểu đồ hiển thị."
        />
      )}
    </Card>
  )
}
