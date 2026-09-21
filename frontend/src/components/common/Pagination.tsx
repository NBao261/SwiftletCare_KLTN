import { Button } from '@/components/ui'

interface PaginationProps {
  page: number
  limit: number
  total: number
  onChange: (page: number) => void
}

/** Pager gọn: Trước/Sau + "x–y trong z" — dùng cho Alerts/Tickets/Harvests */
export default function Pagination({ page, limit, total, onChange }: PaginationProps) {
  if (total <= limit) return null

  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  const hasPrev = page > 1
  const hasNext = to < total

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
