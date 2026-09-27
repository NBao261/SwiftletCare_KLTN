import { Button } from '@/components/ui/Button'

/**
 * Nút "Hủy lọc" cuối hàng bộ lọc các trang Admin (Người dùng, Trang trại, Ticket, Audit log) — nền đỏ
 * (variant danger), cao h-8 chữ text-xs cho thẳng hàng SelectMenu/FilterChip/SortChips. Trang tự quyết
 * khi nào hiện (thường là khi có bộ lọc/sắp xếp khác mặc định) và tự đặt lại state trong `onClick`.
 */
export default function ClearFiltersButton({ onClick, label = 'Hủy lọc' }: { onClick: () => void; label?: string }) {
  return (
    <Button variant="danger" size="sm" className="h-8 px-3.5 text-xs" onClick={onClick}>
      {label}
    </Button>
  )
}
