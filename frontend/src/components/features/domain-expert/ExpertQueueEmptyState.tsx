// Trạng thái rỗng của hàng đợi chuyên gia
import { ChevronRight } from 'lucide-react';
import TableEmptyState from '@/components/common/TableEmptyState';
import { Button } from '@/components/ui';
import { t } from '@/i18n';

interface ExpertQueueEmptyStateProps {
  onViewHistory: () => void;
}

export default function ExpertQueueEmptyState({ onViewHistory }: ExpertQueueEmptyStateProps): JSX.Element {
  return (
    // pt-16: vòng tròn ngoài của hình minh hoạ lố khung 40px phía trên, chừa thêm 24px tới viền thẻ
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-warmGray/15 bg-white px-6 pb-10 pt-16 shadow-card">
      <TableEmptyState
        title={t('Không có cảnh báo chờ kiểm chứng')}
        description={t('Mọi cảnh báo suy luận trong phạm vi đang xem đã có kết luận.')}
      />
      <Button variant="secondary" size="sm" onClick={onViewHistory}>
        {t('Xem lịch sử hoạt động')}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}
