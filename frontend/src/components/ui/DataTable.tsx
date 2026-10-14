import { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { tr } from '@/i18n'
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
  /** Cả dòng bấm được (VD mở trang chi tiết) — nơi gọi tự stopPropagation ở cột có nút riêng
   *  (VD cột "Thao tác") để không vừa mở menu vừa điều hướng, DataTable không tự làm việc đó */
  onRowClick?: (row: T) => void
  /** px — ép mọi dòng cao bằng nhau bất kể 1 hay nhiều dòng nội dung, để khung bảng không đổi theo dữ liệu */
  rowHeight?: number
  /** Ít dòng hơn số này (VD trang cuối) thì chèn dòng trống cho đủ — khung bảng giữ nguyên chiều cao. Đi kèm `rowHeight` */
  minRows?: number
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
  columns, rows, getRowKey, sortKey, sortDirection = 'asc', onSortChange, emptyMessage = 'Không có dữ liệu', onRowClick, rowHeight, minRows = 0,
}: DataTableProps<T>) {
  // Dòng "không có dữ liệu" cũng chiếm 1 chỗ trong minRows
  const fillerCount = Math.max(0, minRows - Math.max(rows.length, 1))
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
                  // [SỬA NGOÀI ADMIN — nhánh feat/admin-settings-config-logs-pages] Ảnh hưởng MỌI bảng của mọi role. Đổi: tiêu đề cột `text-caption uppercase` → .label-caption (12px, không in hoa — FE_Design v2.5.0 §2.8); nút sort trong <th> cũng bỏ `uppercase tracking-[0.04em]`
                  className={cn('label-caption whitespace-nowrap px-4 py-3', ALIGN_CLASS[col.align ?? 'left'], col.className)}
                >
                  {col.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(col.key)}
                      className={cn('inline-flex items-center gap-1 transition-colors hover:text-charcoal', sortKey === col.key && 'text-charcoal')}
                    >
                      {tr(col.header)}
                      {sortKey === col.key && (sortDirection === 'asc' ? <IconSortAsc width={12} height={12} /> : <IconSortDesc width={12} height={12} />)}
                    </button>
                  ) : tr(col.header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-warmGray/10">
            {rows.length === 0 && (
              <tr style={rowHeight ? { height: rowHeight } : undefined}>
                <td colSpan={columns.length} className={cn('px-4 text-center text-small text-warmGray', rowHeight ? 'py-0' : 'py-10')}>
                  {tr(emptyMessage)}
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row) }
                } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                style={rowHeight ? { height: rowHeight } : undefined}
                className={cn('transition-colors hover:bg-warmGray/5', onRowClick && 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-charcoal')}
              >
                {columns.map(col => (
                  <td key={col.key} className={cn('px-4 py-3 align-middle text-charcoal', ALIGN_CLASS[col.align ?? 'left'], col.className)}>
                    {col.render(row, index)}
                  </td>
                ))}
              </tr>
            ))}
            {Array.from({ length: fillerCount }, (_, i) => (
              <tr key={`filler-${i}`} aria-hidden="true" style={rowHeight ? { height: rowHeight } : undefined}>
                <td colSpan={columns.length} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
