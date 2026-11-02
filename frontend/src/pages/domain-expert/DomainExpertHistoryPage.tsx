/**
 * DomainExpertHistoryPage — Lịch sử hoạt động
 *
 * Trang mới — SRS EXPERT-FR-009 (lịch sử quyết định của chuyên gia).
 * Farm Owner cũng xem được trang này (ở chế độ FARM_SIDE_ROLES).
 *
 * Bucket: pages/domain-expert/ — §12.4.
 */
import { History } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';

export default function DomainExpertHistoryPage() {
  return (
    <div className="w-full max-w-screen-xl mx-auto flex flex-col gap-6">
      {/* Tiêu đề */}
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-charcoal flex items-center gap-2.5">
          <History className="h-7 w-7 text-graphite" />
          Lịch sử hoạt động
        </h1>
        <p className="text-sm text-warmGray">
          Toàn bộ quyết định, kết luận và thay đổi tham số bạn đã thực hiện.
        </p>
      </div>

      {/* Nội dung — Đang chờ API spec từ Kiệt (G-03) */}
      {/* TODO(G-03): Kết nối GET /domain-expert/history khi Kiệt hoàn thành backend */}
      <div className="rounded-2xl border border-warmGray/15 bg-white p-10">
        <EmptyState
          title="Chức năng đang được phát triển"
          description="Lịch sử hoạt động sẽ hiển thị tại đây sau khi API backend hoàn thiện (G-03)."
        />
      </div>
    </div>
  );
}
