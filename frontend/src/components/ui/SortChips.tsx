import { SortAscendingIcon, SortDescendingIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import type { SortDirection } from '@/types'

export interface SortChipField<K extends string> {
  key: K
  label: string
}

interface SortChipsProps<K extends string> {
  fields: SortChipField<K>[]
  sortBy: K
  sortDir: SortDirection
  /** Bấm chip đang chọn → trang tự đảo chiều; bấm chip khác → trang tự chọn trường đó (chiều mặc định do trang quyết) */
  onChange: (key: K) => void
  label?: string
}

/**
 * Nhóm nút "Sắp xếp:" — lấy nguyên thiết kế ở trang Ticket của Admin, dùng chung cho Người dùng, Trang trại,
 * Ticket, Audit log. Nhãn `.label-caption` + chip tròn cao bằng SelectMenu/FilterChip. Chip đang sắp: nền
 * charcoal chữ trắng + icon chiều Phosphor (bold 12px); chip khác: nền xám nhạt, hover đậm hơn. Đổi chip là
 * đổi màu ngay, không hiệu ứng động. Chỉ hiển thị — trạng thái sortBy/sortDir do trang giữ.
 */
export default function SortChips<K extends string>({ fields, sortBy, sortDir, onChange, label = 'Sắp xếp:' }: SortChipsProps<K>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label-caption">{label}</span>
      {fields.map(f => {
        const active = sortBy === f.key
        return (
          <button
            key={f.key}
            type="button"
            aria-pressed={active}
            title={active ? `Đang xếp ${sortDir === 'asc' ? 'tăng' : 'giảm'} dần — bấm để đảo chiều` : undefined}
            onClick={() => onChange(f.key)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold',
              active ? 'bg-charcoal text-white' : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20',
            )}
          >
            {f.label}
            {active && (sortDir === 'asc'
              ? <SortAscendingIcon size={12} weight="bold" />
              : <SortDescendingIcon size={12} weight="bold" />)}
          </button>
        )
      })}
    </div>
  )
}
