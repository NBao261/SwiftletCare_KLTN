/**
 * ExpertQueueEmptyState.tsx — Trạng thái rỗng nghệ thuật cho Hàng đợi việc Chuyên gia Miền
 *
 * Phong cách thiết kế: Lấy cảm hứng từ TableEmptyState (Trang Thống kê sản lượng)
 * - Vòng tròn quỹ đạo đồng tâm viền nét đứt
 * - Quầng sáng xanh chanh nhạt (limeMist) tỏa ra từ tâm
 * - Chồng thẻ viễn trắc bay nhẹ, thẻ trung tâm có tick bảo chứng an toàn
 * - Các icon vệ tinh đặc thù chuyên gia: Đàn chim, Phán quyết, Nhiệt ẩm, Fuzzy Logic, Viễn trắc
 * - Tiêu đề, mô tả súc tích và nút điều hướng xem lịch sử
 */

import {
  Bird,
  ShieldCheck,
  Thermometer,
  Cpu,
  SlidersHorizontal,
  Wifi,
  CheckCircle2,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface ExpertQueueEmptyStateProps {
  onViewHistory: () => void;
}

// 6 icon vệ tinh đối xứng hai bên theo 3 tầng (trên, giữa, dưới)
const SATELLITE_ICONS: Array<{ icon: LucideIcon; positionClass: string; isAccent?: boolean }> = [
  { icon: Bird, positionClass: 'left-3 top-2', isAccent: true },
  { icon: Thermometer, positionClass: '-left-6 top-1/2 -translate-y-1/2' },
  { icon: SlidersHorizontal, positionClass: 'left-3 bottom-2' },
  { icon: ShieldCheck, positionClass: 'right-3 top-2', isAccent: true },
  { icon: Cpu, positionClass: '-right-6 top-1/2 -translate-y-1/2' },
  { icon: Wifi, positionClass: 'right-3 bottom-2' },
];

// Chấm trang trí quỹ đạo
const ORBIT_DOTS: string[] = [
  'left-14 top-0 h-1.5 w-1.5',
  'right-14 top-0 h-1.5 w-1.5',
  'left-0 top-10 h-1 w-1',
  'right-0 top-10 h-1 w-1',
  'left-0 bottom-10 h-1 w-1',
  'right-0 bottom-10 h-1 w-1',
  'left-14 bottom-0 h-1.5 w-1.5',
  'right-14 bottom-0 h-1.5 w-1.5',
];

export default function ExpertQueueEmptyState({ onViewHistory }: ExpertQueueEmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-warmGray/15 bg-white p-6 sm:p-8 shadow-card text-center transition-all">
      {/* ── Cụm đồ họa minh họa an toàn viễn trắc ── */}
      <div className="relative flex h-48 w-80 sm:w-96 items-center justify-center" aria-hidden>
        {/* Vòng tròn quỹ đạo & quầng sáng xanh chanh */}
        <span className="absolute h-64 w-64 rounded-full border border-warmGray/10" />
        <span className="absolute h-44 w-44 rounded-full border border-dashed border-warmGray/20" />
        <span className="absolute h-24 w-24 rounded-full border border-warmGray/15" />
        <span className="absolute h-16 w-64 rounded-full bg-limeMist/80 blur-2xl" />

        {ORBIT_DOTS.map(dotClass => (
          <span key={dotClass} className={cn('absolute rounded-full bg-accent-600/50', dotClass)} />
        ))}

        {/* 3 Thẻ trạng thái giả xếp tầng — thẻ giữa nổi bật biểu tượng an toàn */}
        <div className="relative flex flex-col items-center gap-2">
          {/* Thẻ mờ phía trên */}
          <div className="flex w-52 sm:w-56 items-center gap-2.5 rounded-xl border border-warmGray/10 bg-white/70 px-3 py-2 shadow-2xs">
            <span className="h-6 w-6 shrink-0 rounded-full bg-warmGray/10" />
            <span className="flex flex-1 flex-col gap-1">
              <span className="h-1.5 w-24 rounded-full bg-warmGray/15" />
              <span className="h-1.5 w-16 rounded-full bg-warmGray/10" />
            </span>
          </div>

          {/* Thẻ chính giữa: Biểu chứng an toàn 100% */}
          <div className="flex w-56 sm:w-64 items-center justify-between rounded-xl border-2 border-accent-600 bg-white px-3.5 py-2.5 shadow-card">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-charcoal">Hệ thống an toàn</span>
                <span className="text-[10px] text-warmGray">Fuzzy Logic tự động</span>
              </div>
            </div>
            <span className="rounded-full bg-accent-50 px-2 py-0.5 font-mono text-[10px] font-bold text-accent-900 border border-accent-600/30">
              100%
            </span>
          </div>

          {/* Thẻ mờ phía dưới */}
          <div className="flex w-52 sm:w-56 items-center gap-2.5 rounded-xl border border-warmGray/10 bg-white/70 px-3 py-2 shadow-2xs">
            <span className="h-6 w-6 shrink-0 rounded-full bg-warmGray/10" />
            <span className="flex flex-1 flex-col gap-1">
              <span className="h-1.5 w-20 rounded-full bg-warmGray/15" />
              <span className="h-1.5 w-28 rounded-full bg-warmGray/10" />
            </span>
          </div>
        </div>

        {/* 6 Icon vệ tinh bay quanh */}
        {SATELLITE_ICONS.map(({ icon: SatelliteIcon, positionClass, isAccent }) => (
          <span
            key={positionClass}
            className={cn(
              'absolute flex h-8 w-8 items-center justify-center rounded-xl bg-white text-graphite shadow-card ring-1 ring-warmGray/15',
              positionClass
            )}
          >
            <SatelliteIcon size={15} className={isAccent ? 'text-accent-700' : 'text-warmGray'} />
          </span>
        ))}
      </div>

      {/* ── Thông điệp xác nhận an tâm ── */}
      <div className="mt-4 flex max-w-md flex-col items-center gap-1.5">
        <h2 className="text-base sm:text-lg font-bold text-charcoal">
          Không có sự cố chờ thẩm định
        </h2>
        <p className="text-xs sm:text-[13px] leading-relaxed text-warmGray">
          Tất cả cảnh báo suy luận AI trong phạm vi giám sát hiện tại đã được thẩm định và xử lý xong.
          Hệ thống Fuzzy Logic đang vận hành ổn định trong ngưỡng an toàn.
        </p>

        {/* Nút hành động xem lịch sử dạng pill thanh lịch */}
        <button
          type="button"
          onClick={onViewHistory}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-warmGray/25 bg-stone/40 px-4 py-1.5 text-xs font-semibold text-charcoal shadow-2xs transition-all hover:bg-stone/70 hover:border-warmGray/40 active:scale-98"
        >
          <span>Xem lịch sử hoạt động</span>
          <ChevronRight className="h-3.5 w-3.5 text-warmGray" />
        </button>
      </div>
    </div>
  );
}
