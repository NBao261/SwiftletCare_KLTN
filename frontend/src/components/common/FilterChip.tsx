import { cn } from '@/utils/cn'

interface FilterChipProps {
  active: boolean
  label: string
  onClick: () => void
}

/** Chip lọc dạng pill — dùng chung giữa AlertsPage (status/severity) và TicketsPage (status) */
export default function FilterChip({ active, label, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
        active ? 'bg-charcoal text-white' : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20',
      )}
    >
      {label}
    </button>
  )
}
