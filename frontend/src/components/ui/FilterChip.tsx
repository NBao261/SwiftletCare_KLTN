import { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { tr } from '@/i18n'

interface FilterChipProps {
  active: boolean
  label: ReactNode
  onClick: () => void
  size?: 'sm' | 'lg'
}

const SIZE_CLASS: Record<NonNullable<FilterChipProps['size']>, string> = {
  sm: 'px-3.5 py-[9px] text-small max-sm:py-[13px]',
  lg: 'px-5 py-3 text-sm',
}

/** Chip lọc dạng pill — VD hàng lọc, chọn nguyên nhân trong popup xác nhận cảnh báo */
export default function FilterChip({ active, label, onClick, size = 'sm' }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Chữ dài (VD tên nhà, Zone) không kéo chip quá khung chứa: cắt "…", rê chuột xem đủ
      title={typeof label === 'string' ? tr(label) : undefined}
      className={cn(
        'max-w-full truncate rounded-full font-semibold transition-colors',
        SIZE_CLASS[size],
        // Đang chọn: pill trắng viền mảnh như SectionTabs, không tô đen (một nút tô đậm mỗi màn, C-03)
        active ? 'bg-white text-charcoal shadow-card ring-1 ring-warmGray/25' : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20 hover:text-charcoal',
      )}
    >
      {tr(label)}
    </button>
  )
}
