/**
 * BirdCountMonitorCard — Theo dõi đếm chim (VISION-FR-013)
 * Stitch v3: Phần trái dưới màn hình 01_Expert_Dashboard_v3
 * SRS: VISION-FR-013, EXPERT-FR-003
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Video, CheckCircle, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { useExpertBirdTrends, useExpertPendingAlerts } from '@/hooks/domain-expert/useExpertDashboard'
import LiveStreamModal from './LiveStreamModal'

interface Props {
  zoneId: string
  farmId: string
}

const INFERRED_TYPES = ['NOISE_ANOMALY', 'SENSOR_ANOMALY', 'FORECAST_BREACH', 'LOW_RETURN_RATE']

function MetricPill({
  label, value, subtext, isBadge,
}: {
  label: string; value: string; subtext: string; isBadge?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-warmGray/15 bg-stone/40 px-3 py-2.5 text-center">
      <div className="flex items-center gap-1">
        <span className="text-xl font-extrabold text-charcoal leading-tight">{value}</span>
      </div>
      <span className="text-[11px] font-semibold text-warmGray">{label}</span>
      {isBadge ? (
        <span className="inline-flex rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
          {subtext}
        </span>
      ) : (
        <span className="text-[10px] text-warmGray/80">{subtext}</span>
      )}
    </div>
  )
}

export default function BirdCountMonitorCard({ zoneId, farmId }: Props) {
  const [showLive, setShowLive] = useState(false)
  const navigate = useNavigate()
  const { data: birdTrends, isLoading: isLoadingBird } = useExpertBirdTrends(zoneId, 7)
  const { data: pendingAlerts, isLoading: isLoadingAlerts } = useExpertPendingAlerts(farmId, zoneId)

  const isLoading = isLoadingBird || isLoadingAlerts

  if (isLoading) {
    return (
      <Card size="lg" className="flex flex-col gap-4">
        <LoadingSkeleton count={5} className="h-10 w-full" />
      </Card>
    )
  }

  const latest = birdTrends?.records?.[birdTrends.records.length - 1]
  const morningExit = latest?.morning_exit != null ? latest.morning_exit.toLocaleString('vi-VN') : '—'
  const eveningEntry = latest?.evening_entry != null ? latest.evening_entry.toLocaleString('vi-VN') : '—'
  const hasReturnRate = birdTrends?.avg_return_rate !== null && birdTrends?.avg_return_rate !== undefined
  const returnRate = hasReturnRate ? `${birdTrends!.avg_return_rate!.toFixed(1)}%` : '—'
  const returnSubtext = hasReturnRate
    ? (birdTrends!.avg_return_rate! >= 95 ? 'Đạt chuẩn ≥ 95%' : 'Cần theo dõi')
    : 'Chưa có số liệu'

  // Lọc đúng 4 loại cảnh báo suy luận chuyên gia (EXPERT-FR-003)
  const filteredAlerts = (pendingAlerts ?? []).filter(a => INFERRED_TYPES.includes(a.type))
  const topAlerts = filteredAlerts.slice(0, 2)

  return (
    <>
      <Card size="lg" className="flex flex-col gap-5 hover:shadow-md transition-all duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-h2 text-charcoal">Theo dõi đếm chim</h2>
            <p className="mt-0.5 text-xs text-warmGray">Module camera phát hiện & bounding box</p>
          </div>
        </div>

        {/* Nút Live Stream giữ nguyên vị trí dưới tiêu đề */}
        <button
          type="button"
          onClick={() => setShowLive(true)}
          className="flex items-center gap-2 self-start rounded-full bg-charcoal px-4 py-2 text-xs font-bold text-limeMist transition-all hover:bg-charcoal/80 active:scale-95"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <Video size={14} className="text-limeMist shrink-0" />
          Xem Live Stream (Bounding Box)
        </button>

        {/* 3 chỉ số chim */}
        <div className="grid grid-cols-3 gap-3">
          <MetricPill label="Chim bay ra (Sáng)" value={morningExit} subtext="05:15 – 06:45" />
          <MetricPill label="Chim bay về (Chiều)" value={eveningEntry} subtext="17:00 – 18:30" />
          <MetricPill label="Tỷ lệ quay về" value={returnRate} subtext={returnSubtext} isBadge={hasReturnRate} />
        </div>

        {/* 2 cảnh báo suy luận gần nhất hoặc Empty State */}
        {topAlerts.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-warmGray">
                Cảnh báo suy luận cần kiểm chứng
              </p>
            </div>
            {topAlerts.map(alert => (
              <div
                key={alert._id}
                className="flex items-start justify-between gap-3 rounded-xl border border-warmGray/15 bg-stone/30 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-charcoal">{alert.title}</p>
                  <p className="text-[11px] text-warmGray">
                    {new Date(alert.created_at).toLocaleString('vi-VN', {
                      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/expert/audit-logs?alertId=${alert._id}`)}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-success/20 px-3 py-1 text-[11px] font-bold text-success transition-all hover:bg-success/30 cursor-pointer"
                >
                  <CheckCircle size={12} />
                  Kiểm chứng
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone/20 p-4 text-center">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5">
              <CheckCircle size={16} />
            </div>
            <p className="text-xs font-bold text-charcoal">Không có cảnh báo suy luận</p>
            <p className="text-[11px] text-warmGray mt-0.5">Mọi chỉ số đàn chim & vi khí hậu đang hoạt động ổn định</p>
          </div>
        )}

        {filteredAlerts.length > 2 && (
          <Link
            to="/expert/audit-logs"
            className="flex items-center gap-1 text-xs font-semibold text-charcoal underline-offset-2 hover:underline"
          >
            Xem {filteredAlerts.length - 2} cảnh báo khác
            <ChevronRight size={13} />
          </Link>
        )}
      </Card>

      {showLive && <LiveStreamModal onClose={() => setShowLive(false)} />}
    </>
  )
}
