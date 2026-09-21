import { cn } from '@/utils/cn'

interface FilterChipProps {
  active: boolean
  label: string
  onClick: () => void
  size?: 'sm' | 'lg'
}

const SIZE_CLASS: Record<NonNullable<FilterChipProps['size']>, string> = {
  sm: 'px-3.5 py-1.5 text-xs',
  lg: 'px-5 py-2.5 text-sm',
}

/** Chip lọc dạng pill — dùng chung giữa AlertsPage (status/severity) và TicketsPage (status) */
export default function FilterChip({ active, label, onClick, size = 'sm' }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full font-semibold transition-colors',
        SIZE_CLASS[size],
        active ? 'bg-charcoal text-white' : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20',
      )}
    >
      {label}
    </button>
  )
}
