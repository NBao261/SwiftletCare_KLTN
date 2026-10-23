import { tr } from '@/i18n';
import { cn } from '@/lib/cn';

interface ChartEmptyFrameProps {
  message: string;
  // Chiều cao bằng chiều cao biểu đồ thật (VD h-64, h-72) để khung không nhảy khi có dữ liệu
  className?: string;
}

// Số vạch lưới ngang, bằng số vạch biểu đồ thật hay vẽ
const GRID_LINES = 4;

// Khung biểu đồ khi chưa có dữ liệu: giữ lưới ngang và trục dưới, không cột, không số, chữ thông báo ở giữa (FE_Design 8)
export default function ChartEmptyFrame({ message, className }: ChartEmptyFrameProps): JSX.Element {
  return (
    <div className={cn('relative h-64 w-full', className)} role="img" aria-label={tr(message)}>
      <div className="absolute inset-x-0 bottom-6 top-2 flex flex-col justify-between">
        {Array.from({ length: GRID_LINES }, (_, index) => (
          <div key={index} className="border-t border-warmGray/15" />
        ))}
        <div className="border-t border-warmGray/30" />
      </div>
      <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 text-center text-sm text-warmGray">{tr(message)}</p>
    </div>
  );
}
