import { useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { Camera } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme'
import { cn } from '@/lib/cn'

const RANGE_TABS = ['24 Giờ', '7 Ngày', '30 Ngày', 'Mùa sinh sản'] as const
type RangeTab = (typeof RANGE_TABS)[number]

interface RangeDataset {
  total: number
  deltaPercent: number
  accuracy: number
  labels: string[]
  values: number[]
  /** index → vai trò cột, tô màu theo đúng chú giải bên dưới chart */
  peakReturnIndex: number
  peakDepartIndex: number
  stableIndex: number
}

/**
 * VISION-FR-006/008/009/010/011 — module AI Vision (Raspberry Pi + YOLOv8)
 * chưa triển khai (ai-pipeline/ chỉ là scaffold, models/ rỗng — xem CLAUDE.md).
 * Không có endpoint nào trả số lượt chim vào/ra tổ theo giờ, nên toàn bộ số
 * liệu thẻ này là minh hoạ cố định, không gọi API.
 */
const MOCK_DATASETS: Record<RangeTab, RangeDataset> = {
  '24 Giờ': {
    total: 14820, deltaPercent: 18.4, accuracy: 96.8,
    labels: ['05h', '07h', '09h', '11h', '13h', '15h', '17h', '18h', '19h', '21h'],
    values: [180, 2100, 640, 720, 980, 1360, 3120, 3040, 2040, 640],
    peakReturnIndex: 6, peakDepartIndex: 1, stableIndex: 8,
  },
  '7 Ngày': {
    total: 96400, deltaPercent: 9.1, accuracy: 96.2,
    labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
    values: [12800, 13100, 12600, 14200, 15400, 14800, 13500],
    peakReturnIndex: 4, peakDepartIndex: 0, stableIndex: 6,
  },
  '30 Ngày': {
    total: 412300, deltaPercent: 5.6, accuracy: 95.4,
    labels: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'],
    values: [96500, 101200, 104800, 109800],
    peakReturnIndex: 3, peakDepartIndex: 0, stableIndex: 1,
  },
  'Mùa sinh sản': {
    total: 1284000, deltaPercent: 22.7, accuracy: 94.9,
    labels: ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6'],
    values: [180200, 195400, 210800, 232100, 244900, 220600],
    peakReturnIndex: 4, peakDepartIndex: 0, stableIndex: 5,
  },
}

function barColors(d: RangeDataset): string[] {
  return d.values.map((_, i) => {
    if (i === d.peakReturnIndex) return CHART_COLORS.climateOrange
    if (i === d.peakDepartIndex) return '#D2F93A' // lime-500 — "đỉnh chim xuất đàn"
    if (i === d.stableIndex) return CHART_COLORS.charcoal
    return CHART_COLORS.gray300
  })
}

/** "AI Vision • Camera cửa thu chim" — card trái dưới Dashboard (screenshot mục 3). */
export default function BirdVisionCard() {
  const [tab, setTab] = useState<RangeTab>('24 Giờ')
  const data = MOCK_DATASETS[tab]

  const chartData = useMemo(() => ({
    labels: data.labels,
    datasets: [{ data: data.values, backgroundColor: barColors(data), borderRadius: 4, maxBarThickness: 28 }],
  }), [data])

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, legend: { display: false } },
  } as ChartOptions<'bar'>), [])

  return (
    <Card size="lg" className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-charcoal" />
          <p className="label-caption">AI Vision · Camera cửa thu chim</p>
        </div>
        <p className="text-[11px] font-medium italic text-warmGray">This data is FAKE and has not been MOCKAPI</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="leading-none">
          <span className="text-[34px] font-extrabold tracking-tight text-charcoal">{data.total.toLocaleString('vi-VN')}</span>
          <span className="ml-2 text-sm font-medium text-warmGray">lượt chim vào tổ</span>
        </p>
        <Badge tone="positive">+{data.deltaPercent}% vs kỳ trước</Badge>
      </div>

      <div className="flex gap-1 rounded-2xl bg-warmGray/10 p-1">
        {RANGE_TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-xl px-2 py-1.5 text-xs font-semibold transition-colors',
              tab === t ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="h-56">
        <Bar data={chartData} options={chartOptions} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-warmGray/10 pt-3 text-xs text-warmGray">
        <div className="flex flex-wrap items-center gap-3">
          <LegendDot colorClass="bg-climateOrange" label="Đỉnh chim về tổ" />
          <LegendDot colorClass="bg-[#D2F93A]" label="Đỉnh chim xuất đàn" />
          <LegendDot colorClass="bg-charcoal" label="Ổn định đêm" />
        </div>
        <span className="flex items-center gap-1.5 font-medium">
          <Camera width={13} height={13} />
          Độ chính xác AI Model: {data.accuracy}% (YOLOv8 Edge)
        </span>
      </div>
    </Card>
  )
}

function LegendDot({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', colorClass)} />
      {label}
    </span>
  )
}
