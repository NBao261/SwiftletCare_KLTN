import { Button } from '@/components/ui/Button'
import { IconX } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

// Nút "Hủy lọc"; trang tự quyết khi nào hiện và tự đặt lại state
export default function ClearFiltersButton({ onClick, label = 'Huỷ lọc', count, tone = 'neutral', className }: {
  onClick: () => void
  label?: string
  count?: number
  tone?: 'neutral' | 'danger'
  className?: string
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className={cn('h-8 px-3.5 text-xs', tone === 'danger' && 'border-red-500/20 bg-red-500/10 font-medium text-red-600 hover:bg-red-500/15', className)}
      onClick={onClick}
    >
      <IconX width={14} height={14} />
      {label}
      {count !== undefined && count > 0 && <span className="tabular-nums">{count}</span>}
    </Button>
  )
}
