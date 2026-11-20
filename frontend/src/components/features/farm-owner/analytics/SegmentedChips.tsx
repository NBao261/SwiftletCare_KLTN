import { cn } from '@/lib/cn';

interface SegmentedChipsProps<Value extends string | number> {
  options: Array<{ value: Value; label: string }>;
  value: Value;
  onChange: (value: Value) => void;
  ariaLabel: string;
}

// Nhóm nút chọn 1 giá trị (khoảng thời gian, số tuần, số ngày) đặt ở góc phải header khung
export default function SegmentedChips<Value extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedChipsProps<Value>): JSX.Element {
  return (
    <div role="group" aria-label={ariaLabel} className="flex shrink-0 gap-1 rounded-full bg-warmGray/10 p-1">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'h-8 rounded-full px-3 text-small font-semibold transition-colors duration-150 max-sm:h-10',
            // Kiểu SectionTabs: pill trắng trên nền xám, không tô đen (C-03)
            option.value === value ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
