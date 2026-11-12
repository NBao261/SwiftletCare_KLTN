// ExpertQueueEmptyState — trạng thái rỗng của Hàng đợi việc chuyên gia, cùng hình minh hoạ TableEmptyState của Farm Owner
import { ChevronRight } from 'lucide-react';
import TableEmptyState from '@/components/common/TableEmptyState';
import { Button } from '@/components/ui';

interface ExpertQueueEmptyStateProps {
  onViewHistory: () => void;
}

export default function ExpertQueueEmptyState({ onViewHistory }: ExpertQueueEmptyStateProps): JSX.Element {
  return (
    // pt-16: vòng tròn ngoài của hình minh hoạ lố khung 40px phía trên, chừa thêm 24px tới viền thẻ
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-warmGray/15 bg-white px-6 pb-10 pt-16 shadow-card">
      <TableEmptyState
        title="Không có sự cố chờ thẩm định"
        description="Tất cả cảnh báo suy luận AI trong phạm vi giám sát hiện tại đã được thẩm định và xử lý xong."
      />
      <Button variant="secondary" size="sm" onClick={onViewHistory}>
        Xem lịch sử hoạt động
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}
