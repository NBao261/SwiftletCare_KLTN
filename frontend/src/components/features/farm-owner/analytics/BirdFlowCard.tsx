import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { Camera } from 'lucide-react'
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme'
import { Card } from '@/components/ui'

interface HourlyPoint { hour: string; exit: number; entry: number }

/**
 * VISION-FR-008/009 — lưu lượng chim vào/ra THEO GIỜ. Backend chỉ có
 * `/analytics/bird-count/daily` (gộp theo ngày, không theo giờ) và ai-pipeline
 * (Raspberry Pi + YOLOv8) vẫn là scaffold chưa deploy (xem CLAUDE.md) — không
 * có endpoint nào trả số liệu theo giờ để gọi thật. Toàn bộ mảng dưới đây là
 * minh hoạ cố định, thay bằng 1 hook React Query thật (vd. `useBirdFlowHourly`)
 * ngay khi BE có endpoint `/analytics/bird-count/hourly`.
 */
const MOCK_HOURLY: HourlyPoint[] = [
  { hour: '05:00', exit: 3120, entry: 180 },
  { hour: '06:00', exit: 4320, entry: 420 },
  { hour: '09:00', exit: 640, entry: 720 },
  { hour: '12:00', exit: 380, entry: 980 },
  { hour: '15:00', exit: 420, entry: 1360 },
  { hour: '18:00', exit: 260, entry: 3040 },
  { hour: '19:00', exit: 180, entry: 6840 },
  { hour: '21:00', exit: 120, entry: 1180 },
]
const MOCK_CAMERAS = ['Cam-Zone-A', 'Cam-Zone-B']

export default function BirdFlowCard({ onExpandCorrelation }: { onExpandCorrelation?: () => void }) {
  const totalExit = MOCK_HOURLY.reduce((sum, p) => sum + p.exit, 0)
  const totalEntry = MOCK_HOURLY.reduce((sum, p) => sum + p.entry, 0)
  const returnRate = totalExit > 0 ? (totalEntry / totalExit) * 100 : 0

  const chartData = useMemo(() => ({
    labels: MOCK_HOURLY.map(p => p.hour),
    datasets: [
      { label: 'Bay đi', data: MOCK_HOURLY.map(p => p.exit), backgroundColor: CHART_COLORS.climateOrange, borderRadius: 6, maxBarThickness: 18 },
      { label: 'Về tổ', data: MOCK_HOURLY.map(p => p.entry), backgroundColor: CHART_COLORS.accentGreen, borderRadius: 6, maxBarThickness: 18 },
    ],
  }), [])

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    plugins: { ...baseChartOptions.plugins, legend: { display: true, position: 'top' as const, labels: { boxWidth: 10, font: { family: 'Plus Jakarta Sans', size: 11 } } } },
  } as ChartOptions<'bar'>), [])

  return (
    <Card size="lg" className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h2 text-charcoal">Lưu lượng chim vào/ra theo giờ</h2>
        <p className="text-[11px] font-medium italic text-warmGray">This data is FAKE and has not been MOCKAPI</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <p className="leading-none">
          <span className="text-[28px] font-extrabold tracking-tight text-charcoal">{(totalExit + totalEntry).toLocaleString('vi-VN')}</span>
          <span className="ml-2 text-sm font-medium text-warmGray">con</span>
        </p>
        <p className="text-sm text-warmGray">
          Bay đi: <span className="font-semibold text-climateOrange">{totalExit.toLocaleString('vi-VN')}</span>
          {' · '}Về tổ: <span className="font-semibold text-charcoal">{totalEntry.toLocaleString('vi-VN')}</span>
          {' · '}Tỷ lệ về tổ: <span className="font-semibold text-charcoal">{returnRate.toFixed(1)}%</span>
        </p>
      </div>

      <div className="h-56">
        <Bar data={chartData} options={chartOptions} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-warmGray/10 pt-3 text-xs text-warmGray">
        <span className="flex items-center gap-1.5 font-medium">
          <Camera width={13} height={13} />
          Cụm camera AI Vision: {MOCK_CAMERAS.join(' & ')}
        </span>
        {onExpandCorrelation && (
          <button onClick={onExpandCorrelation} className="font-semibold text-charcoal hover:underline">
            Xem phân tích đàn →
          </button>
        )}
      </div>
    </Card>
  )
}
