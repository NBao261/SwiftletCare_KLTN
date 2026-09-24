import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

interface PaginationProps {
  page: number
  limit: number
  total: number
  onChange: (page: number) => void
  /**
   * simple   — chỉ nút Trước/Sau + info x–y trong z (mặc định, Admin pages)
   * numbered — số trang 1–2–…–N + prev/next (Technician ticket table)
   */
  variant?: 'simple' | 'numbered'
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

/** Pager dùng chung — simple: Trước/Sau (Admin), numbered: số trang 1-2-…-N (Technician) */
export default function Pagination({ page, limit, total, onChange, variant = 'simple' }: PaginationProps) {
  if (total <= limit) return null

  const from       = (page - 1) * limit + 1
  const to         = Math.min(page * limit, total)
  const totalPages = Math.ceil(total / limit)
  const hasPrev    = page > 1
  const hasNext    = to < total

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
