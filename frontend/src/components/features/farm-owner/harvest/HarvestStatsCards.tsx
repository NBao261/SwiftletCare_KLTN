import { Card } from '@/components/ui'
import { formatDate, vnYearMonth } from '@/lib/helpers'
import type { HarvestBatch } from '@/types'

interface HarvestStatsCardsProps {
  batches: HarvestBatch[]
}

/** HarvestStatsCards – 3 chỉ số tính trực tiếp từ danh sách Harvest Batch đã fetch, không số liệu giả */
export default function HarvestStatsCards({ batches }: HarvestStatsCardsProps) {
  const now = vnYearMonth(new Date())
  const thisMonthBatches = batches.filter(b => {
    const d = vnYearMonth(b.harvest_date)
    return d.month === now.month && d.year === now.year
  })
  const monthKg = thisMonthBatches.reduce((sum, b) => sum + b.weight_grams, 0) / 1000

  const totalWeight = batches.reduce((sum, b) => sum + b.weight_grams, 0)
  const totalNests = batches.reduce((sum, b) => sum + b.nest_count, 0)
  const avgPerNest = totalNests > 0 ? totalWeight / totalNests : null

  const latest = [...batches].sort((a, b) => b.harvest_date.localeCompare(a.harvest_date))[0]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card className="flex flex-col gap-1">
        <p className="label-caption">Sản lượng tháng {now.month}/{now.year}</p>
        <p className="leading-none">
          <span className="text-3xl font-extrabold tracking-tight text-charcoal">{monthKg.toFixed(2)}</span>
          <span className="ml-2 text-sm font-medium text-warmGray">kg</span>
        </p>
        <p className="text-xs text-warmGray">{thisMonthBatches.length} đợt thu hoạch</p>
      </Card>

      <Card className="flex flex-col gap-1">
        <p className="label-caption">Khối lượng trung bình</p>
        <p className="leading-none">
          <span className="text-3xl font-extrabold tracking-tight text-charcoal">
            {avgPerNest !== null ? avgPerNest.toFixed(1) : '--'}
          </span>
          <span className="ml-2 text-sm font-medium text-warmGray">g / tổ</span>
        </p>
        <p className="text-xs text-warmGray">Tính trên {totalNests} tổ, {batches.length} đợt</p>
      </Card>

      <Card className="flex flex-col gap-1">
        <p className="label-caption">Tổng số đợt thu hoạch</p>
        <p className="leading-none">
          <span className="text-3xl font-extrabold tracking-tight text-charcoal">{batches.length}</span>
          <span className="ml-2 text-sm font-medium text-warmGray">đợt</span>
        </p>
        <p className="text-xs text-warmGray">
          {latest ? `Gần nhất: ${formatDate(latest.harvest_date)}` : 'Chưa có đợt nào'}
        </p>
      </Card>
    </div>
  )
}
