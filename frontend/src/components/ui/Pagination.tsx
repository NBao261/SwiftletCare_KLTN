import { IconChevronRight, IconChevronsRight } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

/** Nút trần, không viền — chỉ trang đang xem có nền charcoal */
const ITEM_CLASS = 'inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm text-charcoal transition-colors hover:bg-warmGray/10 disabled:cursor-not-allowed disabled:text-warmGray/40 disabled:hover:bg-transparent'

interface PaginationProps {
  page: number
  limit: number
  total: number
  onChange: (page: number) => void
}

// [SỬA NGOÀI ADMIN — nhánh feat/admin-settings-config-logs-pages] Ảnh hưởng MỌI trang có phân trang của mọi role. Đổi: cửa sổ số trang luôn đủ 3 trang (trang 1 → 1 2 3 … n; trang cuối → 1 … n-2 n-1 n), trước đó là trang hiện tại ±1 (trang 1 chỉ hiện 1 2 … n).
/**
 * Số trang cần hiện: trang đầu, trang cuối, cửa sổ luôn đủ 3 trang quanh trang hiện tại (ở 2 đầu thì dồn
 * vào trong: trang 1 → 1 2 3, trang cuối → n-2 n-1 n); khoảng trống giữa thành "…" — trừ khi khoảng
 * trống chỉ có 1 trang thì hiện luôn số đó (1 2 3 thay vì 1 … 3).
 */
export function pageItems(page: number, pageCount: number): (number | '…')[] {
  const start = Math.max(1, Math.min(page - 1, pageCount - 2))
  const shown = (p: number) => p === 1 || p === pageCount || (p >= start && p <= start + 2)
  const items: (number | '…')[] = []
  for (let p = 1; p <= pageCount; p++) {
    if (shown(p) || (shown(p - 1) && shown(p + 1))) items.push(p)
    else if (items[items.length - 1] !== '…') items.push('…')
  }
  return items
}

/** Pager: "x–y trong z" + « ‹ 1 … 4 5 6 … 30 › » — dùng cho Alerts/Tickets/Users/Audit log */
export default function Pagination({ page, limit, total, onChange }: PaginationProps) {
  if (total <= limit) return null

  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  const pageCount = Math.ceil(total / limit)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-sm text-warmGray">
        Hiển thị {from}–{to} trong {total}
      </p>
      <nav aria-label="Phân trang" className="flex flex-wrap items-center gap-1">
        <button type="button" className={ITEM_CLASS} aria-label="Trang đầu" disabled={page <= 1} onClick={() => onChange(1)}>
          <IconChevronsRight width={16} height={16} className="rotate-180" />
        </button>
        <button type="button" className={ITEM_CLASS} aria-label="Trang trước" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <IconChevronRight width={16} height={16} className="rotate-180" />
        </button>
        {pageItems(page, pageCount).map((item, i) =>
          item === '…' ? (
            <span key={`gap-${i}`} className="w-6 text-center text-sm text-warmGray">…</span>
          ) : (
            <button
              key={item}
              type="button"
              aria-current={item === page ? 'page' : undefined}
              aria-label={`Trang ${item}`}
              onClick={() => item !== page && onChange(item)}
              className={cn(ITEM_CLASS, item === page && 'bg-charcoal font-semibold text-white hover:bg-charcoal')}
            >
              {item}
            </button>
          ),
        )}
        <button type="button" className={ITEM_CLASS} aria-label="Trang sau" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
          <IconChevronRight width={16} height={16} />
        </button>
        <button type="button" className={ITEM_CLASS} aria-label="Trang cuối" disabled={page >= pageCount} onClick={() => onChange(pageCount)}>
          <IconChevronsRight width={16} height={16} />
        </button>
      </nav>
    </div>
  )
}
