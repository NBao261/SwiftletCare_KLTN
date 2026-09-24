import { forwardRef, useMemo, useState } from 'react'
import { Scatter } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { CHART_COLORS, baseChartOptions } from '@/lib/chartTheme'
import { useCorrelation } from '@/hooks/farm-owner/useAnalytics'
import { pearsonCorrelation } from '@/components/features/farm-owner/analytics/analytics.constants'
import { Badge, Card } from '@/components/ui'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'

function correlationLabel(r: number): string {
  const abs = Math.abs(r)
  const strength = abs >= 0.7 ? 'rất mạnh' : abs >= 0.4 ? 'khá mạnh' : abs >= 0.2 ? 'yếu' : 'không rõ rệt'
  const direction = r >= 0 ? 'thuận' : 'nghịch'
  return `Tương quan ${direction} ${strength}`
}

/**
 * ANALYTICS-FR-003, VISION-FR-010 — tương quan Độ ẩm × Return rate. Endpoint
 * `/analytics/correlation` có thật và được gọi thật ở đây, nhưng return_rate
 * bên trong nó phụ thuộc module VISION (ai-pipeline chưa deploy, xem
 * CLAUDE.md) nên vẫn phải gắn nhãn "dữ liệu giả" (FE_Design_Claude.md §5.4/§7,
 * mục "Phân tích tương quan môi trường ↔ return rate") cho tới khi VISION lên thật.
 */
const CorrelationCard = forwardRef<HTMLDivElement, { zoneId: string }>(({ zoneId }, ref) => {
  const [days, setDays] = useState<30 | 90>(30)
  const { data, isLoading } = useCorrelation(zoneId, days)

  const points = useMemo(
    () => (data?.points ?? []).filter((p): p is typeof p & { return_rate: number } => p.return_rate !== null),
    [data],
  )
  const r = useMemo(() => pearsonCorrelation(points.map(p => p.avg_humidity), points.map(p => p.return_rate)), [points])

  const chartData = useMemo(() => ({
    datasets: [{
      label: 'Độ ẩm × Return rate',
      data: points.map(p => ({ x: p.avg_humidity, y: p.return_rate })),
      backgroundColor: 'rgba(39,35,31,0.55)',
      pointRadius: 4,
    }],
  }), [points])

  const chartOptions = useMemo(() => ({
    ...baseChartOptions,
    scales: {
      x: { ...baseChartOptions.scales.x, title: { display: true, text: 'Độ ẩm (%)', color: CHART_COLORS.warmGray, font: { family: 'Plus Jakarta Sans', size: 11 } } },
      y: { ...baseChartOptions.scales.y, title: { display: true, text: 'Return rate (%)', color: CHART_COLORS.warmGray, font: { family: 'Plus Jakarta Sans', size: 11 } } },
    },
  } as ChartOptions<'scatter'>), [])

  return (
    <Card size="lg" ref={ref} className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h2 text-charcoal">Tương quan Độ ẩm & Tỷ lệ đậu tổ</h2>
        <p className="text-[11px] font-medium italic text-warmGray">This data is FAKE and has not been MOCKAPI</p>
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-56 w-full" />
      ) : points.length < 2 ? (
        <EmptyState
          title="Chưa đủ dữ liệu tương quan"
          description="Cần module VISION (Camera AI đếm chim, Raspberry Pi) hoạt động để có return rate thật."
          // Nút mở rộng 90 ngày trước đây chỉ nằm trong nhánh points.length >= 2 — nếu 30 ngày chưa đủ
          // 2 điểm nhưng 90 ngày thì đủ, người dùng kẹt ở EmptyState và không có cách nào bấm sang 90.
          action={days === 30 && (
            <button onClick={() => setDays(90)} className="text-sm font-semibold text-charcoal hover:underline">
              Thử mở rộng sang 90 ngày →
            </button>
          )}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {r !== null && (
              <>
                <p className="text-sm text-charcoal">
                  Hệ số tương quan Pearson <span className="font-bold">R = {r >= 0 ? '+' : ''}{r.toFixed(2)}</span>
                </p>
                <Badge tone={Math.abs(r) >= 0.4 ? 'positive' : 'neutral'}>{correlationLabel(r)}</Badge>
              </>
            )}
          </div>
          <div className="h-56">
            <Scatter data={chartData} options={chartOptions} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-warmGray/10 pt-3 text-xs text-warmGray">
            <span>Tập mẫu: {points.length} điểm dữ liệu trong {days} ngày qua</span>
            <button onClick={() => setDays(d => (d === 30 ? 90 : 30))} className="font-semibold text-charcoal hover:underline">
              {days === 30 ? 'Mở rộng tương quan (90 ngày) →' : 'Thu gọn về 30 ngày ←'}
            </button>
          </div>
        </>
      )}
    </Card>
  )
})
CorrelationCard.displayName = 'CorrelationCard'

export default CorrelationCard
