/**
 * DomainExpertQueuePage — Hàng đợi việc cần xử lý (Trang chủ Chuyên gia)
 *
 * FE_Design §12.0 c dòng 1 — Chốt 27/10/2026:
 *   Trang chủ của Chuyên gia là hàng đợi việc, KHÔNG phải dashboard số liệu.
 *   Chuyên gia vào hệ thống → thấy ngay: cảnh báo chờ kết luận, đề xuất hệ số
 *   chờ thẩm định, báo cáo chờ kết luận.
 *
 * SRS EXPERT-FR-001..005, Report 3 §2.4.
 *
 * Bucket: pages/domain-expert/ — §12.4.
 */
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, SlidersHorizontal, FileText, ClipboardList, ChevronRight } from 'lucide-react';
import { useAlertsWithFilters } from '@/hooks/domain-expert/useExpertAlerts';
import { useZoneStore } from '@/stores/zoneStore';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';

// Thẻ từng nhóm việc trong queue
function QueueSection({
  icon: Icon,
  title,
  count,
  description,
  href,
  urgent,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  description: string;
  href: string;
  urgent?: boolean;
}) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className={[
        'group flex w-full items-center gap-5 rounded-2xl border bg-white p-5 text-left',
        'shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5',
        urgent && count > 0
          ? 'border-orange-300 bg-orange-50'
          : 'border-warmGray/15',
      ].join(' ')}
    >
      {/* Icon badge */}
      <div
        className={[
          'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl',
          urgent && count > 0 ? 'bg-orange-100' : 'bg-warmGray/10',
        ].join(' ')}
      >
        <Icon
          className={[
            'h-6 w-6',
            urgent && count > 0 ? 'text-orange-600' : 'text-graphite',
          ].join(' ')}
        />
      </div>

      {/* Nội dung */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-charcoal">{title}</span>
          {count > 0 && (
            <span
              className={[
                'rounded-full px-2 py-0.5 text-[11px] font-bold',
                urgent
                  ? 'bg-orange-500 text-white'
                  : 'bg-accent-600 text-charcoal',
              ].join(' ')}
            >
              {count}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-warmGray">{description}</p>
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-warmGray/50 transition-transform group-hover:translate-x-1" />
    </button>
  );
}

export default function DomainExpertQueuePage() {
  const { selectedFarmId, selectedZoneId } = useZoneStore();

  // Lấy cảnh báo đang chờ kết luận (PENDING)
  const {
    kpiCounts,
    isLoading,
  } = useAlertsWithFilters(
    selectedFarmId ?? undefined,
    selectedZoneId ?? undefined,
  );

  const pendingCount = kpiCounts?.pending ?? 0;

  if (isLoading) {
    return (
      <div className="flex w-full max-w-screen-xl flex-col gap-6 mx-auto">
        <LoadingSkeleton count={3} className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-screen-xl mx-auto flex flex-col gap-6">
      {/* Tiêu đề trang */}
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-charcoal flex items-center gap-2.5">
          <ClipboardList className="h-7 w-7 text-accent-600" />
          Hàng đợi việc cần xử lý
        </h1>
        <p className="text-sm text-warmGray">
          Tổng hợp tất cả cảnh báo, đề xuất và báo cáo đang chờ thẩm định của bạn.
        </p>
      </div>

      {/* Nhóm việc ưu tiên cao */}
      <section className="flex flex-col gap-3">
        <h2 className="label-caption text-warmGray uppercase tracking-wide">
          Ưu tiên xử lý
        </h2>

        <QueueSection
          icon={ShieldCheck}
          title="Thẩm định cảnh báo AI"
          count={pendingCount}
          description="Cảnh báo suy luận chưa có kết luận — cần xem bằng chứng và xác nhận / bác bỏ"
          href="/domain-expert/alert-verdicts"
          urgent
        />
      </section>

      {/* Nhóm việc chuyên môn */}
      <section className="flex flex-col gap-3">
        <h2 className="label-caption text-warmGray uppercase tracking-wide">
          Chuyên môn định kỳ
        </h2>

        <div className="flex flex-col gap-3">
          <QueueSection
            icon={SlidersHorizontal}
            title="Cân chỉnh Ngưỡng & Hệ số mờ"
            count={0}
            description="Điều chỉnh ngưỡng vi khí hậu, hệ số logic mờ và tham số phát hiện bất thường"
            href="/domain-expert/tuning"
          />

          <QueueSection
            icon={FileText}
            title="Báo cáo & Kết luận"
            count={0}
            description="Lập báo cáo sức khỏe định kỳ và gửi khuyến nghị cho Chủ nhà yến"
            href="/domain-expert/reports"
          />
        </div>
      </section>

      {/* Trạng thái trống khi không có việc gì */}
      {pendingCount === 0 && (
        <div className="rounded-2xl border border-warmGray/15 bg-white p-8">
          <EmptyState
            title="Không có việc cần xử lý"
            description="Tất cả cảnh báo đã được thẩm định. Hệ thống sẽ thông báo khi có việc mới."
          />
        </div>
      )}
    </div>
  );
}
