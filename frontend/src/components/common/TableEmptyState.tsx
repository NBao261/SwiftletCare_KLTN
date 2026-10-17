import { Bird, Camera, Cpu, Thermometer, Wifi, Wrench, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface TableEmptyStateProps {
  title: string;
  description?: string;
}

// Icon nhỏ quanh hình minh hoạ: đối xứng trái/phải theo 3 hàng (trên, giữa, dưới), hàng giữa đẩy ra xa hơn tạo vòng cung
const FLOATING_ICONS: Array<{ icon: LucideIcon; positionClass: string }> = [
  { icon: Bird, positionClass: 'left-3 top-2' },
  { icon: Thermometer, positionClass: '-left-6 top-1/2 -translate-y-1/2' },
  { icon: Wrench, positionClass: 'left-3 bottom-2' },
  { icon: Wifi, positionClass: 'right-3 top-2' },
  { icon: Cpu, positionClass: '-right-6 top-1/2 -translate-y-1/2' },
  { icon: Camera, positionClass: 'right-3 bottom-2' },
];

// Chấm hoạ tiết nhỏ rải trên các vòng tròn, đối xứng hai bên
const DECORATION_DOTS: string[] = [
  'left-14 top-0 h-1.5 w-1.5',
  'right-14 top-0 h-1.5 w-1.5',
  'left-0 top-10 h-1 w-1',
  'right-0 top-10 h-1 w-1',
  'left-0 bottom-10 h-1 w-1',
  'right-0 bottom-10 h-1 w-1',
  'left-14 bottom-0 h-1.5 w-1.5',
  'right-14 bottom-0 h-1.5 w-1.5',
];

// Một thẻ giả trong chồng thẻ minh hoạ
function PlaceholderCard({ isHighlighted }: { isHighlighted: boolean }): JSX.Element {
  const frameClass = isHighlighted
    ? 'border-2 border-accent-600 bg-white shadow-card'
    : 'border border-warmGray/15 bg-white/80';

  return (
    <div className={cn('flex w-56 items-center gap-3 rounded-xl px-3 py-2.5', frameClass)}>
      <span className="h-7 w-7 shrink-0 rounded-full bg-warmGray/10" />
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="h-2 w-28 rounded-full bg-warmGray/15" />
        <span className="h-2 w-20 rounded-full bg-warmGray/10" />
      </span>
    </div>
  );
}

// Trạng thái rỗng chuẩn của bảng: vòng tròn mờ, chồng 3 thẻ giả (thẻ giữa nổi bật), icon thiết bị/chim yến quanh, tiêu đề + mô tả
export default function TableEmptyState({ title, description }: TableEmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4 px-4 text-center">
      <div className="relative flex h-44 w-80 items-center justify-center" aria-hidden>
        {/* Hoạ tiết nền: 3 vòng tròn (vòng giữa nét đứt), quầng sáng xanh chanh sau thẻ giữa, chấm nhỏ hai bên */}
        <span className="absolute h-64 w-64 rounded-full border border-warmGray/10" />
        <span className="absolute h-44 w-44 rounded-full border border-dashed border-warmGray/20" />
        <span className="absolute h-24 w-24 rounded-full border border-warmGray/15" />
        <span className="absolute h-14 w-60 rounded-full bg-limeMist/70 blur-2xl" />
        {DECORATION_DOTS.map(dotClass => (
          <span key={dotClass} className={cn('absolute rounded-full bg-accent-600/50', dotClass)} />
        ))}

        <div className="relative flex flex-col items-center gap-2">
          <PlaceholderCard isHighlighted={false} />
          <PlaceholderCard isHighlighted />
          <PlaceholderCard isHighlighted={false} />
        </div>

        {FLOATING_ICONS.map(({ icon: FloatingIcon, positionClass }) => (
          <span
            key={positionClass}
            className={cn('absolute flex h-8 w-8 items-center justify-center rounded-lg bg-white text-graphite shadow-card ring-1 ring-warmGray/10', positionClass)}
          >
            <FloatingIcon size={16} className={FloatingIcon === Bird ? 'text-accent-700' : undefined} />
          </span>
        ))}
      </div>

      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-h3 text-charcoal">{title}</p>
        {description && <p className="text-small text-warmGray">{description}</p>}
      </div>
    </div>
  );
}
