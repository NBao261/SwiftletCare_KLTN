import { ReactNode, useLayoutEffect, useRef, useState } from 'react'
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
  // Nơi gọi tự stopPropagation ở cột có nút riêng
  onRowClick?: (row: T) => void
  // px: ép mọi dòng cao bằng nhau bất kể 1 hay nhiều dòng nội dung, để khung bảng không đổi theo dữ liệu
  rowHeight?: number
  // Chèn dòng trống cho đủ để khung bảng giữ chiều cao
  minRows?: number
  // px: bề rộng tối thiểu của bảng trước khi cuộn ngang; bảng đặt trong cột hẹp (VD 8/12) truyền số nhỏ hơn
  minTableWidth?: number
  // Chỉ hiện số dòng này, còn lại cuộn; tiêu đề đứng yên
  visibleRows?: number
  // Khung bảng cao bằng phần tử cha, nơi gọi tự đặt chiều cao cha
  fillHeight?: boolean
  // Điện thoại: danh sách thẻ thay bảng; trả null thì bỏ dòng đó (VD dòng đệm của FixedRowsTable)
  mobileCard?: (row: T) => ReactNode
}

const ALIGN_CLASS: Record<NonNullable<DataTableColumn<unknown>['align']>, string> = {
  left: 'text-left', right: 'text-right', center: 'text-center',
}

// Bảng dữ liệu dùng chung
export default function DataTable<T>(props: DataTableProps<T>) {
  const { mobileCard, rows, getRowKey, onRowClick, emptyMessage = 'Không có dữ liệu', fillHeight = false } = props
  if (!mobileCard) return <TableView {...props} />
  const cards = rows.flatMap(row => {
    const card = mobileCard(row)
    return card === null ? [] : [{ key: getRowKey(row), row, card }]
  })
  return (
    <>
      <div className={cn('max-sm:hidden', fillHeight && 'h-full')}>
        <TableView {...props} />
      </div>
      {cards.length === 0 ? (
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-warmGray/15 bg-white px-4 text-center text-small text-warmGray shadow-card sm:hidden">
          {tr(emptyMessage)}
        </div>
      ) : (
        <ul className="flex flex-col gap-2 sm:hidden">
          {cards.map(({ key, row, card }) => (
            <li
              key={key}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row) }
              } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? 'button' : undefined}
              className={cn('rounded-2xl border border-warmGray/15 bg-white p-4 shadow-card', onRowClick && 'cursor-pointer active:bg-warmGray/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-charcoal')}
            >
              {card}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// Bảng HTML (từ sm trở lên, hoặc mọi khổ khi không có mobileCard)
function TableView<T>({
  columns, rows, getRowKey, sortKey, sortDirection = 'asc', onSortChange, emptyMessage = 'Không có dữ liệu', onRowClick, rowHeight, minRows = 0, minTableWidth = 960, visibleRows, fillHeight = false,
}: DataTableProps<T>) {
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  const [scrollbarWidth, setScrollbarWidth] = useState(0)
  const isScrollable = visibleRows !== undefined && rowHeight !== undefined
  // Đo thanh cuộn của thân để cột tiêu đề và cột dữ liệu thẳng hàng
  useLayoutEffect(() => {
    const body = bodyScrollRef.current
    if (!isScrollable || !body) return
    const measure = () => setScrollbarWidth(body.offsetWidth - body.clientWidth)
    measure()
    // Khung lấp chiều cao cha (fillHeight) đổi cỡ theo màn hình → thanh cuộn có thể hiện/ẩn, đo lại
    const observer = new ResizeObserver(measure)
    observer.observe(body)
    return () => observer.disconnect()
  }, [isScrollable, rows, visibleRows])
  // Dòng "không có dữ liệu" cũng chiếm 1 chỗ trong minRows
  const fillerCount = Math.max(0, minRows - Math.max(rows.length, 1))

  // table-fixed để width của từng cột được giữ đúng tỉ lệ
  const tableClass = 'w-full table-fixed border-collapse text-small'

  const headerCells = columns.map(col => (
    <th
      key={col.key}
      scope="col"
      // Tiêu đề cột dùng .label-caption
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
  ))

  const body = (
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
  )

  // Chế độ cuộn: tách tiêu đề và thân thành 2 bảng
  if (isScrollable) {
    return (
      <div className={cn('overflow-hidden rounded-2xl border border-warmGray/15 bg-white shadow-card', fillHeight && 'flex h-full min-h-0 flex-col')}>
        <div ref={headerScrollRef} className="overflow-hidden border-b border-warmGray/15 bg-warmGray/5" style={{ paddingRight: scrollbarWidth }}>
          <table className={tableClass} style={{ minWidth: minTableWidth }}>
            <thead>
              <tr>{headerCells}</tr>
            </thead>
          </table>
        </div>
        <div
          ref={bodyScrollRef}
          className={cn('overflow-auto', fillHeight && 'min-h-0 flex-1')}
          style={fillHeight ? undefined : { maxHeight: visibleRows * rowHeight }}
          onScroll={event => {
            if (headerScrollRef.current) headerScrollRef.current.scrollLeft = event.currentTarget.scrollLeft
          }}
        >
          <table className={tableClass} style={{ minWidth: minTableWidth }}>
            {body}
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-warmGray/15 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className={tableClass} style={{ minWidth: minTableWidth }}>
          <thead>
            <tr className="border-b border-warmGray/15 bg-warmGray/5">{headerCells}</tr>
          </thead>
          {body}
        </table>
      </div>
    </div>
  )
}
