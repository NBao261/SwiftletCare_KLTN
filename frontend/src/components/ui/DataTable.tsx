import { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { IconSortAsc, IconSortDesc } from '@/components/ui/icons'
import type { SortDirection } from '@/types'

export interface DataTableColumn<T> {
  key: string
  header: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  className?: string
  render: (row: T, index: number) => ReactNode
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  sortKey?: string
  sortDirection?: SortDirection
  onSortChange?: (key: string) => void
  emptyMessage?: string
  /** Cả dòng bấm được (VD mở trang chi tiết) — cột "Thao tác" tự stopPropagation để không kích hoạt đôi */
  onRowClick?: (row: T) => void
  /** px — ép mọi dòng cao bằng nhau bất kể 1 hay nhiều dòng nội dung, để khung bảng không đổi theo dữ liệu */
  rowHeight?: number
}

const ALIGN_CLASS: Record<NonNullable<DataTableColumn<unknown>['align']>, string> = {
  left: 'text-left', right: 'text-right', center: 'text-center',
}

/**
 * Bảng dữ liệu dùng chung — FE_Design_Claude.md §9 gọi tên `<DataTable/>` làm
 * component chung cho mọi role nhưng trước đây chưa có implementation nào
 * (mọi danh sách cũ đều là Card xếp hàng, xem TechnicianAlertsPage/TechnicianTicketsPage). Đây là
 * `<table>` HTML ngữ nghĩa đầu tiên trong codebase — style bám đúng token màu/
 * bo góc/shadow hiện có (border-warmGray/15, rounded-2xl, shadow-card), không
 * phát sinh màu/bo góc mới.
 */
export default function DataTable<T>({
  columns, rows, getRowKey, sortKey, sortDirection = 'asc', onSortChange, emptyMessage = 'Không có dữ liệu', onRowClick, rowHeight,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-warmGray/15 bg-white shadow-card">
      <div className="overflow-x-auto">
        {/* table-fixed để width khai báo qua className của từng cột (columns.tsx của trang) được tôn
            trọng đúng tỉ lệ, thay vì co giãn tự do theo nội dung dài nhất (VD ghi chú đỏ ở Trạng thái). */}
        <table className="w-full min-w-[960px] table-fixed border-collapse text-small">
          <thead>
            <tr className="border-b border-warmGray/15 bg-warmGray/5">
              {columns.map(col => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn('whitespace-nowrap px-4 py-3 text-caption uppercase text-warmGray', ALIGN_CLASS[col.align ?? 'left'], col.className)}
                >
                  {col.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(col.key)}
                      // Trình duyệt tự đặt `text-transform: none` mặc định cho <button>, phá mất
                      // `uppercase` kế thừa từ <th> — phải khai báo lại tường minh ở đây.
                      className={cn('inline-flex items-center gap-1 uppercase tracking-[0.04em] transition-colors hover:text-charcoal', sortKey === col.key && 'text-charcoal')}
                    >
                      {col.header}
                      {sortKey === col.key && (sortDirection === 'asc' ? <IconSortAsc width={12} height={12} /> : <IconSortDesc width={12} height={12} />)}
                    </button>
                  ) : col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-warmGray/10">
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-small text-warmGray">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={rowHeight ? { height: rowHeight } : undefined}
                className={cn('transition-colors hover:bg-warmGray/5', onRowClick && 'cursor-pointer')}
              >
                {columns.map(col => (
                  <td key={col.key} className={cn('px-4 py-3 align-middle text-charcoal', ALIGN_CLASS[col.align ?? 'left'], col.className)}>
                    {col.render(row, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
