import { Button } from '@/components/ui/Button'
import { IconX } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

/**
 * Nút "Hủy lọc" cuối hàng bộ lọc các trang Admin (Người dùng, Trang trại, Ticket, Audit log) — Secondary
 * (FE_Design 5.1: xoá bộ lọc không phá huỷ dữ liệu), cao h-8 chữ text-xs cho thẳng hàng SelectMenu/FilterChip/
 * SortChips. Trang tự quyết khi nào hiện (thường là khi có bộ lọc/sắp xếp khác mặc định) và tự đặt lại state
 * trong `onClick`.
 */
// count: số điều kiện lọc đang bật (hiện sau chữ) · tone danger: nền red-500/10, viền red-500/20, chữ red-600 (mẫu Farm Owner)
export default function ClearFiltersButton({ onClick, label = 'Hủy lọc', count, tone = 'neutral', className }: {
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
