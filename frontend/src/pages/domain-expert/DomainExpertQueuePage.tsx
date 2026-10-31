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
import { useNavigate } from 'react-router-dom'
import {
  SlidersHorizontal,
  FileText,
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import {
  useAlertsWithFilters,
  useAllInferredAlerts,
  ALERT_TYPE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_BADGE_CLASS,
} from '@/hooks/domain-expert/useExpertAlerts'
import { useHealthReportList } from '@/hooks/domain-expert/useHealthReports'
import { useExpertAiSuggestion } from '@/hooks/domain-expert/useZoneTuning'
import { useZoneStore } from '@/stores/zoneStore'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'

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
  const { selectedFarmId, selectedFarmName, selectedZoneId, selectedZoneName } = useZoneStore()

  // ── Dữ liệu cảnh báo suy luận AI — đồng bộ 100% với SCADA Banner ───────────
  const { kpiCounts, isLoading: isLoadingAlerts } = useAlertsWithFilters(
    selectedFarmId ?? undefined,
    selectedZoneId ?? undefined,
  )

  const { data: allAlerts = [] } = useAllInferredAlerts(
    selectedFarmId ?? undefined,
    selectedZoneId ?? undefined,
  )

  // ── Dữ liệu báo cáo sức khỏe zone định kỳ ──────────────────────────────────
  const { data: healthReports = [], isLoading: isLoadingReports } = useHealthReportList(
    selectedZoneId ?? undefined,
  )

  // ── Dữ liệu gợi ý tối ưu AI cho tham số Fuzzy Logic ───────────────────────
  const { data: aiSuggestion } = useExpertAiSuggestion(selectedZoneId ?? undefined)

  // ── Tính toán các chỉ số thực chất từ Backend ─────────────────────────────
  const pendingAlerts = useMemo(
    () => allAlerts.filter(a => INFERRED_TYPES.has(a.type) && !a.expert_verdict),
    [allAlerts],
  )

  const pendingCount = kpiCounts?.pending ?? pendingAlerts.length
  const activeAlert = pendingAlerts[0]

  const pendingReports = healthReports.filter(r => !r.expert_conclusion?.text).length
  const publishedReports = Math.max(0, healthReports.length - pendingReports)

  const hasAiTuningSuggestion = Boolean(aiSuggestion?.suggestion)

  const isLoading = isLoadingAlerts || isLoadingReports

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 pt-5">
        <LoadingSkeleton count={3} className="h-52 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 pt-5">
      {/* ── Bento Grid 2 cột bất đối xứng ── */}
      <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">

        {/* ════ CỘT TRÁI (7/12 ≈ 58%): Hàng đợi thẩm định cảnh báo AI — Ưu tiên P0 ════ */}
        <div className="flex flex-col lg:col-span-7">
          {pendingCount > 0 ? (
            /* ── Trạng thái: Có sự cố chờ thẩm định ── */
            <div className="group relative flex h-full flex-col justify-between rounded-2xl border border-amber-300 bg-gradient-to-b from-amber-50/70 via-white to-white p-6 shadow-sm transition-all hover:border-amber-400 hover:shadow-md sm:p-7">
              <div className="flex flex-col gap-5">
                {/* Nhãn phân loại & đếm số lượng */}
                <div className="flex items-center justify-between border-b border-amber-200/70 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-md border border-amber-400 bg-amber-100 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-amber-900">
                      Ưu tiên P0 · Suy luận AI
                    </span>
                    <span className="text-xs font-medium text-warmGray">Cần phán quyết</span>
                  </div>
                  <span className="rounded-full bg-amber-500 px-3 py-1 font-mono text-xs font-bold text-white shadow-xs sm:text-sm">
                    {pendingCount} chờ xử lý
                  </span>
                </div>

                {/* Tiêu đề nhiệm vụ */}
                <div>
                  <h2 className="text-xl font-bold text-charcoal sm:text-2xl">
                    Thẩm định cảnh báo suy luận AI
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-warmGray sm:text-base">
                    Mô hình AI phát hiện vi khí hậu hoặc thiết bị bất thường — Chuyên gia xem bằng chứng viễn trắc để xác nhận hoặc bác bỏ.
                  </p>
                </div>

                {/* Snapshot sự cố đang đứng đầu hàng đợi */}
                <div className="rounded-xl border border-amber-200/90 bg-white/95 p-4.5 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3 pb-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                      <span className="truncate text-base font-bold text-charcoal sm:text-lg">
                        {formatAlertTitle(activeAlert, selectedZoneName)}
                      </span>
                    </div>
                    {activeAlert?.severity && (
                      <span
                        className={`shrink-0 rounded px-2.5 py-0.5 font-mono text-xs font-bold uppercase ${
                          SEVERITY_BADGE_CLASS[activeAlert.severity] || 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {SEVERITY_LABELS[activeAlert.severity] || activeAlert.severity}
                      </span>
                    )}
                  </div>

                  <p className="line-clamp-2 text-sm leading-relaxed text-charcoal/90 sm:text-[15px]">
                    {activeAlert?.message || 'Hệ thống ghi nhận dấu hiệu vi khí hậu bất thường — cần chuyên gia thẩm định.'}
                  </p>

                  <div className="mt-3.5 flex flex-wrap items-center gap-4 border-t border-warmGray/10 pt-2.5 text-xs text-warmGray sm:text-small">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-warmGray/70" />
                      <span className="font-medium">{selectedFarmName || 'Trang trại'} › {selectedZoneName || 'Tầng 1'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-warmGray/70" />
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
              <div className="mt-6 pt-3">
                <button
                  type="button"
                  onClick={() => navigate('/domain-expert/alert-verdicts')}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-charcoal px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-black active:scale-[0.98] sm:w-auto"
                >
                  <span>Vào thẩm định sự cố</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          ) : (
            /* ── Trạng thái: Hàng đợi trống — mọi sự cố đã được xử lý ── */
            <div className="flex h-full flex-col justify-between rounded-2xl border border-warmGray/20 bg-white p-7 shadow-sm sm:p-8">
              <div className="flex flex-col gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-accent-600/30 bg-accent-50">
                  <CheckCircle2 className="h-7 w-7 text-accent-700" />
                </div>
                <h2 className="text-xl font-bold text-charcoal sm:text-2xl">
                  Không có sự cố chờ thẩm định
                </h2>
                <p className="text-sm leading-relaxed text-warmGray sm:text-base">
                  Tất cả cảnh báo suy luận AI trong phạm vi giám sát hiện tại đã được phán quyết. Hệ thống Fuzzy Logic đang vận hành trong ngưỡng an toàn.
                </p>
              </div>
              <div className="mt-7 pt-3">
                <button
                  type="button"
                  onClick={() => navigate('/domain-expert/history')}
                  className="flex items-center gap-2 text-sm font-semibold text-charcoal hover:text-black hover:underline"
                >
                  <span>Xem lịch sử phán quyết</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ════ CỘT PHẢI (5/12 ≈ 42%): Nhiệm vụ điều vận định kỳ ════ */}
        <div className="flex flex-col gap-6 lg:col-span-5">

          {/* ── Thẻ 1: Cấu hình tham số & Hệ số mờ ── */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate('/domain-expert/tuning')}
            onKeyDown={e => e.key === 'Enter' && navigate('/domain-expert/tuning')}
            className="group flex flex-1 cursor-pointer flex-col justify-between rounded-2xl border border-warmGray/20 bg-white p-6 shadow-sm transition-all hover:border-warmGray/40 hover:shadow-md"
          >
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-warmGray/15 bg-stone/70 text-charcoal transition-colors group-hover:border-accent-600/40 group-hover:bg-accent-50 group-hover:text-accent-900">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                {hasAiTuningSuggestion ? (
                  <span className="flex items-center gap-1 rounded-md border border-accent-600/40 bg-accent-50 px-2.5 py-1 font-mono text-xs font-semibold text-accent-900">
                    <Sparkles className="h-3 w-3 text-accent-700" />
                    <span>Có gợi ý AI tối ưu</span>
                  </span>
                ) : (
                  <span className="rounded-md border border-warmGray/20 bg-stone/50 px-2.5 py-1 font-mono text-xs font-semibold text-graphite">
                    Cấu hình vận hành
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-base font-bold text-charcoal transition-colors group-hover:text-black sm:text-lg">
                  Cấu hình Ngưỡng & Tham số mờ
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-warmGray sm:text-[14.5px]">
                  Điều chỉnh ngưỡng vi khí hậu an toàn, ma trận điều khiển mờ (Fuzzy Logic) và độ nhạy phát hiện bất thường thiết bị.
                </p>
              </div>

              {/* 3 Module chuyên môn thực tế có trong màn hình (Trung thực, không bịa số liệu) */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="rounded-md border border-warmGray/15 bg-stone/40 px-2.5 py-1 font-mono text-xs font-medium text-graphite">
                  Ngưỡng vi khí hậu
                </span>
                <span className="rounded-md border border-warmGray/15 bg-stone/40 px-2.5 py-1 font-mono text-xs font-medium text-graphite">
                  Hệ số Fuzzy Logic
                </span>
                <span className="rounded-md border border-warmGray/15 bg-stone/40 px-2.5 py-1 font-mono text-xs font-medium text-graphite">
                  Độ nhạy cảnh báo
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-warmGray/10 pt-3 text-sm font-semibold text-charcoal transition-colors group-hover:text-black">
              <span>Vào cấu hình tham số</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* ── Thẻ 2: Báo cáo sức khỏe & kết luận chuyên môn ── */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate('/domain-expert/reports')}
            onKeyDown={e => e.key === 'Enter' && navigate('/domain-expert/reports')}
            className="group flex flex-1 cursor-pointer flex-col justify-between rounded-2xl border border-warmGray/20 bg-white p-6 shadow-sm transition-all hover:border-warmGray/40 hover:shadow-md"
          >
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-warmGray/15 bg-stone/70 text-charcoal transition-colors group-hover:border-accent-600/40 group-hover:bg-accent-50 group-hover:text-accent-900">
                  <FileText className="h-5 w-5" />
                </div>
                {pendingReports > 0 ? (
                  <span className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 font-mono text-xs font-semibold text-amber-900">
                    Cần ký duyệt ({pendingReports})
                  </span>
                ) : (
                  <span className="rounded-md border border-accent-600/30 bg-accent-50 px-2.5 py-1 font-mono text-xs font-semibold text-accent-900">
                    Đã cập nhật tuần này
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-base font-bold text-charcoal transition-colors group-hover:text-black sm:text-lg">
                  Báo cáo & Kết luận chuyên môn
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-warmGray sm:text-[14.5px]">
                  Đánh giá dữ liệu vi khí hậu tổng hợp theo tuần và ban hành khuyến nghị can thiệp kỹ thuật cho Chủ nhà yến.
                </p>
              </div>

              {/* Số liệu thực tế từ API useHealthReportList */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="rounded-md border border-warmGray/15 bg-stone/40 px-2.5 py-1 font-mono text-xs font-medium text-graphite">
                  Chờ ký duyệt: {pendingReports}
                </span>
                <span className="rounded-md border border-warmGray/15 bg-stone/40 px-2.5 py-1 font-mono text-xs font-medium text-graphite">
                  Đã ban hành: {publishedReports}
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-warmGray/10 pt-3 text-sm font-semibold text-charcoal transition-colors group-hover:text-black">
              <span>Xem danh sách báo cáo</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
