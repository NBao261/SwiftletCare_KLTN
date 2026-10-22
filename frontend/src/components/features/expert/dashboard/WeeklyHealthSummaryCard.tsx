/**
 * WeeklyHealthSummaryCard — Tóm tắt sức khỏe Zone theo tuần
 * Stitch v3: Phần bên phải giữa màn hình 01_Expert_Dashboard_v3
 * SRS: EXPERT-FR-005, ANALYTICS-FR-010
 */

import { Link } from 'react-router-dom'
import { ArrowRight, TrendingUp, Lightbulb } from 'lucide-react'
import { Card } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import MockDataTooltip from '@/components/shared/MockDataTooltip'
import {
  useLatestHealthReport,
  useExpertBirdTrends,
} from '@/hooks/expert/useExpertDashboard'

interface Props {
  zoneId: string
  farmId?: string
}

function StatBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  const pct = value ?? 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-warmGray">{label}</span>
        <span className="text-xs font-bold text-charcoal">
          {value !== null ? `${pct.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stone">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}

export default function WeeklyHealthSummaryCard({ zoneId, farmId: _farmId }: Props) {
  const { data: report, isLoading: isLoadingReport } = useLatestHealthReport(zoneId)
  const { data: birdTrends, isLoading: isLoadingBird } = useExpertBirdTrends(zoneId, 7)

  const isLoading = isLoadingReport || isLoadingBird

  if (isLoading) {
    return (
      <Card size="lg" className="flex flex-col gap-4">
        <LoadingSkeleton count={4} className="h-6 w-full" />
      </Card>
    )
  }

  const tempPct = report?.metrics?.temp_in_range_pct ?? 84.5
  const humidityPct = report?.metrics?.humidity_in_range_pct ?? 91.2
  const avgReturnRate = birdTrends?.avg_return_rate
  const isReturnRateMock = avgReturnRate === null || avgReturnRate === undefined
  const displayReturnRate = !isReturnRateMock ? avgReturnRate : 97.9

  return (
    <Card size="lg" className="flex flex-col gap-5 hover:shadow-md transition-all duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-h2 text-charcoal">Tóm tắt sức khỏe tuần</h2>
          <p className="mt-0.5 text-xs text-warmGray">
            {report
              ? `${new Date(report.period_start).toLocaleDateString('vi-VN')} – ${new Date(report.period_end).toLocaleDateString('vi-VN')}`
              : 'Kỳ đánh giá gần nhất: 14/10 – 20/10'}
          </p>
        </div>
        <TrendingUp className="mt-0.5 shrink-0 text-success" size={20} />
      </div>

      {/* Thanh tiến độ: nhiệt độ & độ ẩm */}
      <div className="flex flex-col gap-3">
        <StatBar label="Nhiệt độ trong ngưỡng (26–31°C)" value={tempPct} color="bg-climateOrange" />
        <StatBar label="Độ ẩm trong ngưỡng (75–95%RH)" value={humidityPct} color="bg-success" />
      </div>

      {/* KPI: Tỷ lệ chim về trung bình */}
      <div className="flex items-center justify-between rounded-xl border border-warmGray/15 bg-stone/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <TrendingUp size={18} className="shrink-0 text-success" />
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] uppercase tracking-wider text-warmGray font-semibold">
                Tỷ lệ chim về tổ TB (7 ngày)
              </p>
              {isReturnRateMock && (
                <MockDataTooltip reason="Dữ liệu mô phỏng — Đang chờ kết nối luồng dữ liệu đếm chim thực tế từ Module AI Camera Cửa thu (VISION-FR-017)." />
              )}
            </div>
            <p className="text-xl font-extrabold text-charcoal leading-tight">
              {displayReturnRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Hộp gợi ý thuật toán AI màu xanh cốm #ECFFA9 */}
      <div className="rounded-2xl border border-[#D4E88B] bg-[#ECFFA9]/60 p-4">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-[#27231F] shrink-0" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#27231F]">
              Gợi ý thuật toán AI
            </span>
          </div>
          <MockDataTooltip reason="Dữ liệu mô phỏng — Hệ thống cần tích lũy tối thiểu 3–14 ngày dữ liệu cảm biến liên tục với độ tin cậy R² ≥ 0.3 để sinh gợi ý thực tế (ANALYTICS-FR-010)." />
        </div>
        <p className="text-xs font-medium leading-relaxed text-[#27231F]/90">
          Đề xuất giảm dải biên độ ẩm xuống 6%RH để tối ưu hệ số mờ.
        </p>
      </div>

      {/* Chân trang Card: Kỳ đánh giá + Link xem báo cáo */}
      <div className="mt-auto flex items-center justify-between border-t border-warmGray/10 pt-3">
        <span className="text-xs font-medium text-warmGray">Kỳ đánh giá: Tuần 42</span>
        <Link
          to="/expert/reports"
          className="flex items-center gap-1 text-xs font-semibold text-charcoal underline-offset-2 hover:underline"
        >
          Xem báo cáo chi tiết
          <ArrowRight size={13} />
        </Link>
      </div>
    </Card>
  )
}
