import { Button } from '@/components/ui/Button'
import { IconChevronRight, IconChevronsRight } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

interface PaginationProps {
  page: number
  limit: number
  total: number
  onChange: (page: number) => void
  /**
   * simple   — chỉ nút Trước/Sau + info x–y trong z (mặc định)
   * numbered — số trang 1–2–…–N + prev/next (Technician ticket table)
   * full     — « ‹ 1 2 3 … N › » cửa sổ luôn đủ 3 trang (các trang Admin: Ticket, Người dùng, Trang trại, Nhật ký…)
   */
  variant?: 'simple' | 'numbered' | 'full'
}

function getPageNumbers(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  if (page > 3) pages.push('…')
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
  if (page < totalPages - 2) pages.push('…')
  pages.push(totalPages)
  return pages
}

// [SỬA NGOÀI ADMIN — nhánh feat/admin-settings-config-logs-pages] Gộp khi merge develop (PR #46): giữ nguyên `simple`/`numbered`
// của develop cho các role khác; thêm `full` = pager cũ của các trang Admin, cửa sổ luôn đủ 3 trang.
/** Nút trần, không viền — chỉ trang đang xem có nền charcoal (variant `full`) */
const ITEM_CLASS = 'inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm text-charcoal transition-colors hover:bg-warmGray/10 disabled:cursor-not-allowed disabled:text-warmGray/40 disabled:hover:bg-transparent'

/**
 * Số trang cần hiện (variant `full`): trang đầu, trang cuối, cửa sổ luôn đủ 3 trang quanh trang hiện tại (ở 2 đầu thì
 * dồn vào trong: trang 1 → 1 2 3, trang cuối → n-2 n-1 n); khoảng trống giữa thành "…" — trừ khi khoảng trống chỉ có
 * 1 trang thì hiện luôn số đó (1 2 3 thay vì 1 … 3).
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

/** Pager dùng chung — simple: Trước/Sau, numbered: số trang 1-2-…-N (Technician), full: « ‹ 1 2 3 … N › » (Admin) */
export default function Pagination({ page, limit, total, onChange, variant = 'simple' }: PaginationProps) {
  if (total <= limit) return null

  const from       = (page - 1) * limit + 1
  const to         = Math.min(page * limit, total)
  const totalPages = Math.ceil(total / limit)
  const hasPrev    = page > 1
  const hasNext    = to < total

  if (variant === 'full') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-sm text-warmGray">
          Hiển thị {from}–{to} trong {total}
        </p>
        <nav aria-label="Phân trang" className="flex flex-wrap items-center gap-1">
          <button type="button" className={ITEM_CLASS} aria-label="Trang đầu" disabled={!hasPrev} onClick={() => onChange(1)}>
            <IconChevronsRight width={16} height={16} className="rotate-180" />
          </button>
          <button type="button" className={ITEM_CLASS} aria-label="Trang trước" disabled={!hasPrev} onClick={() => onChange(page - 1)}>
            <IconChevronRight width={16} height={16} className="rotate-180" />
          </button>
          {pageItems(page, totalPages).map((item, i) =>
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
          <button type="button" className={ITEM_CLASS} aria-label="Trang sau" disabled={!hasNext} onClick={() => onChange(page + 1)}>
            <IconChevronRight width={16} height={16} />
          </button>
          <button type="button" className={ITEM_CLASS} aria-label="Trang cuối" disabled={!hasNext} onClick={() => onChange(totalPages)}>
            <IconChevronsRight width={16} height={16} />
          </button>
        </nav>
      </div>
    )
  }

  if (variant === 'numbered') {
    const pages = getPageNumbers(page, totalPages)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-warmGray/10 bg-warmGray/[0.02] px-5 py-3">
        <p className="text-xs text-warmGray">
          Hiển thị{' '}
          <span className="font-semibold text-charcoal">{from}–{to}</span>
          {' '}/ <span className="font-semibold text-charcoal">{total}</span>
        </p>

        <div className="flex items-center gap-1">
          <Button
            variant="secondary" size="sm"
            disabled={!hasPrev}
            onClick={() => onChange(page - 1)}
            className="h-8 w-8 p-0"
            aria-label="Trang trước"
          >
            ‹
          </Button>

          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-warmGray">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p as number)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  p === page
                    ? 'bg-charcoal text-white'
                    : 'text-warmGray hover:bg-warmGray/10',
                )}
              >
                {p}
              </button>
            ),
          )}

          <Button
            variant="secondary" size="sm"
            disabled={!hasNext}
            onClick={() => onChange(page + 1)}
            className="h-8 w-8 p-0"
            aria-label="Trang tiếp"
          >
            ›
          </Button>
        </div>

        <p className="text-xs text-warmGray">{limit} / trang</p>
      </div>
    )
  }

  // variant === 'simple' (default — giữ nguyên style cũ)
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <p className="text-sm text-warmGray">
        Hiển thị {from}–{to} trong {total}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={!hasPrev} onClick={() => onChange(page - 1)}>
          Trước
        </Button>
        <Button variant="secondary" size="sm" disabled={!hasNext} onClick={() => onChange(page + 1)}>
          Sau
        </Button>
      </div>
    </div>
  )
}
