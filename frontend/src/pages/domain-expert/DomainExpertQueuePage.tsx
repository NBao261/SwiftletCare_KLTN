/**
 * DomainExpertQueuePage — Trang chủ Chuyên gia Miền
 *
 * Layout: Bento Grid 2 cột bất đối xứng bám ngay dưới thanh SCADA.
 * - Không có Header tầng phụ — thông tin ngữ cảnh tập trung ở SCADA Banner.
 * - Cột trái (7/12): Hero Action Card — Thẩm định cảnh báo suy luận AI (Ưu tiên P0).
 * - Cột phải (5/12): Cụm 2 thẻ nhiệm vụ định kỳ (Cấu hình tham số & Báo cáo tuần).
 *
 * Tiêu chuẩn thiết kế (/design-taste-frontend & Anti-Slop):
 * - Không hiển thị số liệu "ảo" / số bịa đặt (Zero Hallucination UI).
 * - Kích thước chữ tăng nhẹ, phân cấp thị giác rõ ràng, độ tương phản cao, dễ đọc trong ca trực.
 * - Mọi dòng chữ trên 2 thẻ bên phải đều mang mục đích nghiệp vụ cụ thể.
 * - Font chữ: Plus Jakarta Sans (đồng nhất toàn hệ thống).
 */

import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  SlidersHorizontal,
  FileText,
  FileCheck,
  ArrowRight,
  Clock,
  MapPin,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'
import {
  useAlertsWithFilters,
  useAllInferredAlerts,
  ALERT_TYPE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_BADGE_CLASS,
} from '@/hooks/domain-expert/useExpertAlerts'
import { useHealthReportConclusionCounts } from '@/hooks/shared/useHealthDays'
import { useHealthDisagreements } from '@/hooks/domain-expert/useHealthDisagreements'
import { shiftDate, vietnamDate } from '@/components/common/healthDay.utils'
import { useExpertAiSuggestion } from '@/hooks/domain-expert/useZoneTuning'
import {
  useParameterReviews,
  useCoefficientProposals,
} from '@/hooks/domain-expert/useExpertReviews'
import { useZoneStore } from '@/stores/zoneStore'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ExpertQueueEmptyState from '@/components/features/domain-expert/ExpertQueueEmptyState'

const INFERRED_TYPES: Set<string> = new Set([
  'NOISE_ANOMALY',
  'SENSOR_ANOMALY',
  'FORECAST_BREACH',
  'LOW_RETURN_RATE',
  'MISTING_INEFFECTIVE',
  'PUMP_DRY',
])

/**
 * Chuẩn hóa tiêu đề cảnh báo — loại bỏ enum thô và khắc phục triệt để chuỗi lỗi "tại undefined"
 */
function formatAlertTitle(alert?: { title?: string; type?: string }, defaultZoneName?: string | null): string {
  if (!alert) return 'Cảnh báo vi khí hậu'
  let title = alert.title || ALERT_TYPE_LABELS[alert.type ?? ''] || alert.type || 'Cảnh báo vi khí hậu'

  // Khắc phục lỗi backend khi zone chưa được nạp
  if (title.includes('undefined')) {
    const typeLabel = ALERT_TYPE_LABELS[alert.type ?? ''] || 'Cảnh báo thiết bị'
    title = defaultZoneName ? `${typeLabel} tại ${defaultZoneName}` : typeLabel
  }

  // Chuyển đổi mã enum kỹ thuật sang thuật ngữ chuyên môn tiếng Việt
  return title
    .replace('PUMP_DRY', 'Bơm khô bất thường')
    .replace('MISTING_INEFFECTIVE', 'Phun sương kém hiệu quả')
    .replace('NOISE_ANOMALY', 'Tiếng ồn bất thường')
    .replace('SENSOR_ANOMALY', 'Cảm biến bất thường')
    .replace('FORECAST_BREACH', 'Dự báo vi phạm ngưỡng')
    .replace('LOW_RETURN_RATE', 'Tỷ lệ chim về giảm')
}

export default function DomainExpertQueuePage() {
  const navigate = useNavigate()
  const { selectedFarmId, selectedFarmName, selectedHouseId, selectedZoneId, selectedZoneName } = useZoneStore()

  // ── Dữ liệu cảnh báo suy luận AI — đồng bộ 100% với SCADA Banner ───────────
  const { kpiCounts, isLoading: isLoadingAlerts } = useAlertsWithFilters(
    selectedFarmId ?? undefined,
    selectedZoneId ?? undefined,
  )

  const { data: allAlerts = [] } = useAllInferredAlerts(
    selectedFarmId ?? undefined,
    selectedZoneId ?? undefined,
  )

  // ── Báo cáo sức khỏe theo nhà: chờ kết luận / đã kết luận (cùng phạm vi tab Báo cáo & Kết luận) ──
  const {
    pending: pendingReports, concluded: publishedReports, isLoading: isLoadingReports,
  } = useHealthReportConclusionCounts(selectedFarmId ?? '', selectedHouseId ?? '')

  // ── Dữ liệu gợi ý tối ưu AI cho tham số Fuzzy Logic ───────────────────────
  const { data: aiSuggestion } = useExpertAiSuggestion(selectedZoneId ?? undefined)

  // ── Dữ liệu mục duyệt tham số & đề xuất hệ số mờ (G-04) ────────────────────
  const { total: pendingReviewsCount } = useParameterReviews({
    farmId: selectedFarmId ?? '',
    zoneId: selectedZoneId ?? undefined,
    status: 'PENDING_REVIEW',
  })
  const { total: pendingProposalsCount } = useCoefficientProposals({
    farmId: selectedFarmId ?? '',
    zoneId: selectedZoneId ?? undefined,
    status: 'PROPOSED',
  })

  const totalPendingReviews = pendingReviewsCount + pendingProposalsCount

  // ── Dữ liệu ngày đánh giá lệch 14 ngày gần nhất (EXPERT-FR-022) ────────────
  const to = vietnamDate()
  const from = shiftDate(to, -13)
  const { totalDays: disagreeingDaysCount } = useHealthDisagreements({
    farmId: selectedFarmId ?? undefined,
    from,
    to,
  })

  // ── Tính toán các chỉ số thực chất từ Backend ─────────────────────────────
  const pendingAlerts = useMemo(
    () => allAlerts.filter(a => INFERRED_TYPES.has(a.type) && !a.expert_verdict),
    [allAlerts],
  )

  const pendingCount = kpiCounts?.pending ?? pendingAlerts.length
  const activeAlert = pendingAlerts[0]

  const hasAiTuningSuggestion = Boolean(aiSuggestion?.suggestion)

  const isLoading = isLoadingAlerts || isLoadingReports

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 pt-5">
        <LoadingSkeleton count={3} className="h-52 w-full rounded-2xl" />
      </div>
    )
  }

  // ── 3 Thẻ nhiệm vụ điều vận định kỳ (Dùng chung cho cả 2 chế độ hiển thị) ──
  const renderActionCards = (containerClassName: string) => (
    <div className={containerClassName}>
      {/* ── Thẻ 1: Cấu hình Ngưỡng & Hệ số mờ ── */}
      <Link
        to="/domain-expert/tuning"
        className="group flex flex-1 flex-col justify-between rounded-2xl border border-warmGray/20 bg-white p-4 shadow-sm transition-all hover:border-warmGray/40 hover:shadow-md sm:p-5"
      >
        <div className="flex flex-col gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-warmGray/15 bg-stone/70 text-charcoal transition-colors group-hover:border-accent-600/40 group-hover:bg-accent-50 group-hover:text-accent-900">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            {hasAiTuningSuggestion ? (
              <span className="flex items-center gap-1 rounded-md border border-accent-600/40 bg-accent-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-900">
                <Sparkles className="h-3 w-3 text-accent-700" />
                <span>Có gợi ý AI tối ưu</span>
              </span>
            ) : (
              <span className="rounded-md border border-warmGray/20 bg-stone/50 px-2 py-0.5 font-mono text-[11px] font-semibold text-graphite">
                Cấu hình vận hành
              </span>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-charcoal transition-colors group-hover:text-black sm:text-[15px]">
              Cấu hình Ngưỡng & Hệ số mờ
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-warmGray sm:text-[12.5px]">
              Thiết lập ngưỡng an toàn và tinh chỉnh hệ số điều khiển mờ cho thiết bị.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="rounded-md border border-warmGray/15 bg-stone/40 px-2.5 py-0.5 text-[11px] font-medium text-graphite">
              Ngưỡng an toàn
            </span>
            <span className="rounded-md border border-warmGray/15 bg-stone/40 px-2.5 py-0.5 text-[11px] font-medium text-graphite">
              Hệ số Fuzzy
            </span>
            <span className="rounded-md border border-warmGray/15 bg-stone/40 px-2.5 py-0.5 text-[11px] font-medium text-graphite">
              Độ nhạy AI
            </span>
          </div>
        </div>

        <div className="mt-3.5 flex items-center justify-between border-t border-warmGray/10 pt-2.5 text-xs font-semibold text-charcoal transition-colors group-hover:text-black sm:text-[13px]">
          <span>Vào cấu hình tham số</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>

      {/* ── Thẻ 2: Mục duyệt tham số & Đề xuất hệ số mờ (G-04) ── */}
      <Link
        to="/domain-expert/reviews"
        className="group flex flex-1 flex-col justify-between rounded-2xl border border-warmGray/20 bg-white p-4 shadow-sm transition-all hover:border-warmGray/40 hover:shadow-md sm:p-5"
      >
        <div className="flex flex-col gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-warmGray/15 bg-stone/70 text-charcoal transition-colors group-hover:border-accent-600/40 group-hover:bg-accent-50 group-hover:text-accent-900">
              <FileCheck className="h-4 w-4" />
            </div>
            {totalPendingReviews > 0 ? (
              <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-orange-700">
                Chờ duyệt ({totalPendingReviews})
              </span>
            ) : (
              <span className="rounded-md border border-warmGray/20 bg-stone/50 px-2 py-0.5 font-mono text-[11px] font-semibold text-graphite">
                Đã đồng bộ
              </span>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-charcoal transition-colors group-hover:text-black sm:text-[15px]">
              Duyệt Tham số & Đề xuất
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-warmGray sm:text-[12.5px]">
              Thẩm định thay đổi thông số từ Chủ trang trại và phê duyệt đề xuất hệ số mờ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="rounded-md border border-warmGray/15 bg-stone/40 px-2.5 py-0.5 text-[11px] font-medium text-graphite">
              Ngưỡng chờ: <strong className="font-semibold text-charcoal">{pendingReviewsCount}</strong>
            </span>
            <span className="rounded-md border border-warmGray/15 bg-stone/40 px-2.5 py-0.5 text-[11px] font-medium text-graphite">
              Đề xuất: <strong className="font-semibold text-charcoal">{pendingProposalsCount}</strong>
            </span>
          </div>
        </div>

        <div className="mt-3.5 flex items-center justify-between border-t border-warmGray/10 pt-2.5 text-xs font-semibold text-charcoal transition-colors group-hover:text-black sm:text-[13px]">
          <span>Mở danh sách phê duyệt</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>

      {/* ── Thẻ 3: Báo cáo sức khỏe & Ngày đánh giá lệch (EXPERT-FR-005, EXPERT-FR-022) ── */}
      <Link
        to={disagreeingDaysCount > 0 && pendingReports === 0 ? '/domain-expert/reports?tab=disagreements' : '/domain-expert/reports'}
        className="group flex flex-1 flex-col justify-between rounded-2xl border border-warmGray/20 bg-white p-4 shadow-sm transition-all hover:border-warmGray/40 hover:shadow-md sm:p-5"
      >
        <div className="flex flex-col gap-2.5 sm:gap-3">
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-warmGray/15 bg-stone/70 text-charcoal transition-colors group-hover:border-accent-600/40 group-hover:bg-accent-50 group-hover:text-accent-900">
              <FileText className="h-4 w-4" />
            </div>
            {pendingReports > 0 ? (
              <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-orange-700">
                Cần ký duyệt ({pendingReports})
              </span>
            ) : disagreeingDaysCount > 0 ? (
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-800">
                Ngày lệch ({disagreeingDaysCount})
              </span>
            ) : (
              <span className="rounded-md border border-accent-600/30 bg-accent-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-900">
                Đã cập nhật tuần này
              </span>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-charcoal transition-colors group-hover:text-black sm:text-[15px]">
              Báo cáo & Ngày đánh giá lệch
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-warmGray sm:text-[12.5px]">
              Ban hành kết luận báo cáo sức khỏe và đối chiếu các ngày chấm thực địa lệch với hệ thống.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="rounded-md border border-warmGray/15 bg-stone/40 px-2.5 py-0.5 text-[11px] font-medium text-graphite">
              Chờ duyệt: <strong className="font-semibold text-charcoal">{pendingReports}</strong>
            </span>
            <span className="rounded-md border border-warmGray/15 bg-stone/40 px-2.5 py-0.5 text-[11px] font-medium text-graphite">
              Ngày lệch: <strong className="font-semibold text-charcoal">{disagreeingDaysCount}</strong>
            </span>
            <span className="rounded-md border border-warmGray/15 bg-stone/40 px-2.5 py-0.5 text-[11px] font-medium text-graphite">
              Đã ban hành: <strong className="font-semibold text-charcoal">{publishedReports}</strong>
            </span>
          </div>
        </div>

        <div className="mt-3.5 flex items-center justify-between border-t border-warmGray/10 pt-2.5 text-xs font-semibold text-charcoal transition-colors group-hover:text-black sm:text-[13px]">
          <span>{disagreeingDaysCount > 0 && pendingReports === 0 ? 'Xem ngày đánh giá lệch' : 'Xem báo cáo & ngày lệch'}</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>
    </div>
  )

  return (
    <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-4 pt-4">
      {pendingCount > 0 ? (
        /* ── KỊCH BẢN 1: CÓ SỰ CỐ P0 → Bento Grid 2 cột bất đối xứng (7/12 vs 5/12) ── */
        <section className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12 lg:gap-5">
          {/* CỘT TRÁI (7/12 ≈ 58%): Hàng đợi thẩm định cảnh báo AI — Ưu tiên P0 */}
          <div className="flex flex-col lg:col-span-7">
            <div className="group relative flex h-full flex-col justify-between rounded-2xl border border-amber-300 bg-gradient-to-b from-amber-50/70 via-white to-white p-4 shadow-sm transition-all hover:border-amber-400 hover:shadow-md sm:p-5">
              <div className="flex flex-col gap-3.5">
                {/* Nhãn phân loại & đếm số lượng */}
                <div className="flex items-center justify-between border-b border-amber-200/70 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md border border-amber-400 bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-900">
                      Ưu tiên P0 · Suy luận AI
                    </span>
                    <span className="text-[11px] font-medium text-warmGray">Cần thẩm định</span>
                  </div>
                  <span className="rounded-full bg-amber-500 px-2.5 py-0.5 font-mono text-xs font-bold text-white shadow-xs">
                    {pendingCount} chờ xử lý
                  </span>
                </div>

                {/* Tiêu đề nhiệm vụ */}
                <div>
                  <h2 className="text-base font-bold text-charcoal sm:text-[18px]">
                    Thẩm định cảnh báo suy luận AI
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-warmGray sm:text-[13px]">
                    Mô hình AI phát hiện vi khí hậu hoặc thiết bị bất thường — Chuyên gia xem bằng chứng viễn trắc để xác nhận hoặc bác bỏ.
                  </p>
                </div>

                {/* Snapshot sự cố đang đứng đầu hàng đợi */}
                <div className="rounded-xl border border-amber-200/90 bg-white/95 p-3.5 shadow-xs sm:p-4">
                  <div className="flex items-center justify-between gap-2.5 pb-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      <span className="truncate text-sm font-bold text-charcoal sm:text-[15px]">
                        {formatAlertTitle(activeAlert, selectedZoneName)}
                      </span>
                    </div>
                    {activeAlert?.severity && (
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          SEVERITY_BADGE_CLASS[activeAlert.severity] || 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {SEVERITY_LABELS[activeAlert.severity] || activeAlert.severity}
                      </span>
                    )}
                  </div>

                  <p className="line-clamp-2 text-xs leading-relaxed text-charcoal/90 sm:text-[13px]">
                    {activeAlert?.message || 'Hệ thống ghi nhận dấu hiệu vi khí hậu bất thường — cần chuyên gia thẩm định.'}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-3.5 border-t border-warmGray/10 pt-2 text-[11px] text-warmGray sm:text-xs">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-warmGray/70" />
                      <span className="font-medium">{selectedFarmName || 'Trang trại'} › {selectedZoneName || 'Tầng 1'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-warmGray/70" />
                      <span className="font-medium">
                        {activeAlert?.created_at
                          ? new Date(activeAlert.created_at).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })
                          : 'Gần đây'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nút điều hướng vào màn hình thẩm định */}
              <div className="mt-3.5 pt-2 sm:mt-4">
                <button
                  type="button"
                  onClick={() => navigate('/domain-expert/alert-verdicts')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-charcoal px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-black active:scale-[0.98] sm:w-auto sm:px-6 sm:text-[13px] whitespace-nowrap"
                >
                  <span>Vào thẩm định sự cố</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (5/12 ≈ 42%): Nhiệm vụ chuyên môn thường trực xếp dọc */}
          {renderActionCards('flex flex-col gap-4 lg:col-span-5')}
        </section>
      ) : (
        /* ── KỊCH BẢN 2: KHÔNG CÓ SỰ CỐ → Empty State nghệ thuật + Grid 3 Cột tác vụ ── */
        <section className="flex flex-col gap-5">
          {/* Component Empty State đồ họa nghệ thuật (tương tự Thống kê sản lượng) */}
          <ExpertQueueEmptyState onViewHistory={() => navigate('/domain-expert/history')} />

          {/* 3 Thẻ nhiệm vụ chuyên môn thường trực dàn đều 3 cột ngang */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-warmGray">
                Nhiệm vụ chuyên môn thường trực
              </h3>
              <span className="text-[11px] text-warmGray">
                3 phân hệ quản lý
              </span>
            </div>
            {renderActionCards('grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-5')}
          </div>
        </section>
      )}
    </div>
  )
}
