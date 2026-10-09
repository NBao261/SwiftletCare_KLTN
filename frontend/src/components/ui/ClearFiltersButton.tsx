import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * Nút "Hủy lọc" cuối hàng bộ lọc các trang Admin (Người dùng, Trang trại, Ticket, Audit log) — thẻ cảnh báo
 * đỏ nhạt (Soft Red Warning Tag) thay vì Secondary trung tính, để phân biệt rõ đây là thao tác reset chứ
 * không phải 1 lựa chọn lọc bình thường. Cao h-8 chữ text-xs cho thẳng hàng SelectMenu/FilterChip/SortChips.
 * Trang tự quyết khi nào hiện (thường là khi có bộ lọc/sắp xếp khác mặc định) và tự đặt lại state trong
 * `onClick`.
 */
export default function ClearFiltersButton({ onClick, label = 'Hủy lọc' }: { onClick: () => void; label?: string }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="h-8 border-alertRed bg-red-50 px-3.5 text-xs text-alertRed hover:bg-red-50"
      onClick={onClick}
    >
      <X width={14} height={14} />
      {label}
    </Button>
  )
}
