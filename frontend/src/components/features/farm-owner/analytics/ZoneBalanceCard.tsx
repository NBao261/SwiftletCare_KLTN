import { useMemo } from 'react'
import { Wind } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useFarmZones } from '@/hooks/shared/useFarms'
import { useEnvCompare } from '@/hooks/farm-owner/useAnalytics'
import { cn } from '@/lib/cn'
import type { Thresholds } from '@/types'

interface ZoneScore {
  zoneId: string
  label: string
  score: number
  status: string
  detail: string
}

/** % đạt yêu cầu của 1 giá trị so với dải ngưỡng [min,max] — 100 khi trong dải, giảm dần khi lệch xa. */
function rangeScore(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 100
  const halfRange = (max - min) / 2 || 1
  const mid = (min + max) / 2
  const overshoot = Math.abs(value - mid) - halfRange
  return Math.max(0, Math.round(100 - (overshoot / halfRange) * 100))
}

function statusFor(score: number): string {
  if (score >= 90) return 'Rất tối ưu'
  if (score >= 80) return 'Tối ưu'
  if (score >= 65) return 'Bình thường'
  return 'Dưới mục tiêu'
}

function barTone(score: number): string {
  if (score >= 80) return 'bg-success'
  if (score >= 65) return 'bg-climateOrange'
  return 'bg-alertRed'
}

/**
 * ANALYTICS-FR-005 (biến thể) — điểm "cân bằng vi khí hậu" mỗi Zone, tính từ
 * dữ liệu thật (`/analytics/env/compare` 24h gần nhất so với `zone.thresholds`
 * thật), KHÔNG phải số liệu giả — chỉ công thức tính điểm (rangeScore) là suy
 * ra ở FE, chưa phải 1 endpoint "điểm cân bằng" riêng của BE.
 */
export default function ZoneBalanceCard({ farmId }: { farmId: string | undefined }) {
  const { data: zones, isLoading: isLoadingZones } = useFarmZones(farmId)
  const zoneIds = useMemo(() => zones?.map(z => z._id) ?? [], [zones])
  const { data: compare, isLoading: isLoadingCompare } = useEnvCompare(zoneIds, '24h')

  const scores: ZoneScore[] = useMemo(() => {
    if (!zones || !compare) return []
    return zones.map(zone => {
      const metrics = compare.zones.find(z => z.zoneId === zone._id)?.metrics
      const T: Thresholds = zone.thresholds
      if (!metrics || metrics.temperature === undefined || metrics.humidity === undefined) {
        return { zoneId: zone._id, label: `${zone.houseName} / ${zone.name}`, score: 0, status: 'Chưa có dữ liệu', detail: 'Chưa nhận telemetry trong 24h qua' }
      }
      const tempScore = rangeScore(metrics.temperature, T.temp_min, T.temp_max)
      const humidityScore = rangeScore(metrics.humidity, T.humidity_min, T.humidity_max)
      const score = Math.round((tempScore + humidityScore) / 2)
      return {
        zoneId: zone._id,
        label: `${zone.houseName} / ${zone.name}`,
        score,
        status: statusFor(score),
        detail: `Độ ẩm ${metrics.humidity.toFixed(1)}%, Nhiệt độ ${metrics.temperature.toFixed(1)}°C`,
      }
    }).sort((a, b) => b.score - a.score)
  }, [zones, compare])

  const worst = scores.filter(s => s.score > 0).sort((a, b) => a.score - b.score)[0]
  const isLoading = isLoadingZones || isLoadingCompare

  return (
    <div className="flex h-full flex-col gap-4">
      <Card size="lg" className="flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-h2 text-charcoal">Chỉ số cân bằng vi khí hậu giữa các Zone</h2>
            <p className="mt-1 text-sm text-warmGray">So với dải ngưỡng đã cấu hình của từng Zone (24h gần nhất)</p>
          </div>
          <Badge tone="neutral">{zones?.length ?? 0} Zone giám sát</Badge>
        </div>

        {isLoading ? (
          <LoadingSkeleton count={3} className="h-10 w-full" />
        ) : scores.length === 0 ? (
          <p className="text-sm text-warmGray">Trang trại này chưa có zone nào.</p>
        ) : (
          <div className="flex flex-col gap-3.5">
            {scores.map(z => (
              <div key={z.zoneId} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium text-charcoal">
                    {z.label} <span className="ml-1 font-normal text-warmGray">{z.status} — {z.detail}</span>
                  </span>
                  <span className="shrink-0 font-bold text-charcoal">{z.score}/100</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-warmGray/10">
                  <div className={cn('h-full rounded-full', barTone(z.score))} style={{ width: `${z.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {worst && worst.score < 75 && (
        <Card variant="active" size="lg" className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/60 text-accent-700">
            <Wind width={18} height={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-charcoal">Gợi ý điều chỉnh — {worst.label}</p>
            <p className="mt-1 text-sm text-charcoal/80">
              Điểm cân bằng đang {worst.status.toLowerCase()} ({worst.score}/100). Cân nhắc kiểm tra chu kỳ phun sương/thông gió của Zone này so với ngưỡng đã cấu hình.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="accent" size="sm" disabled title="Chưa có endpoint áp dụng gợi ý tự động (BE hiện chỉ đọc dữ liệu)">
                Tự động áp dụng PLC
              </Button>
              <p className="text-[11px] font-medium italic text-warmGray">Nút minh hoạ — BE chưa có endpoint ghi/điều khiển tự động</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
