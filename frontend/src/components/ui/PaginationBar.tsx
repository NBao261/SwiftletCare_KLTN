// PaginationBar.tsx — Reusable UI component phân trang chuẩn
// Đặt trong components/ui/ để có thể dùng lại ở FarmOwner/Admin pages.
// Hiển thị: info (x–y / total) + nút số trang + prev/next
interface PaginationBarProps {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPage: (p: number) => void
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

export function PaginationBar({ page, totalPages, totalItems, pageSize, onPage }: PaginationBarProps) {
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, totalItems)
  const pages = getPageNumbers(page, totalPages)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-graphite/10 bg-graphite/[0.02] px-5 py-3">
      <p className="text-xs text-warmGray">
        Hiển thị{' '}
        <span className="font-semibold text-charcoal">{from}–{to}</span>
        {' '}/ <span className="font-semibold text-charcoal">{totalItems}</span> ticket
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          aria-label="Trang trước"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-graphite/20 text-sm text-charcoal transition-colors hover:bg-graphite/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          ‹
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-warmGray">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-charcoal text-white shadow-sm'
                  : 'border border-graphite/20 text-charcoal hover:bg-graphite/10'
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          aria-label="Trang tiếp"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-graphite/20 text-sm text-charcoal transition-colors hover:bg-graphite/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <p className="text-xs text-warmGray">{pageSize} / trang</p>
    </div>
  )
}
