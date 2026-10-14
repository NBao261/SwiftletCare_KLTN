import { useMemo, useState } from 'react'
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable'
import Pagination from '@/components/ui/Pagination'

const DEFAULT_PAGE_SIZE = 10

interface PlaceholderRow {
  placeholder: true
  id: string
  /** Chỉ dòng đệm đầu tiên hiện chữ thông báo, và chỉ khi hoàn toàn không có bản ghi nào */
  showNotice: boolean
}
type PaddedRow<T> = T | PlaceholderRow

function isPlaceholder<T>(row: PaddedRow<T>): row is PlaceholderRow {
  return typeof row === 'object' && row !== null && 'placeholder' in row
}

interface FixedRowsTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  /** px — chiều cao cứng của mỗi dòng */
  rowHeight: number
  /** Số dòng mỗi trang = số dòng khung bảng luôn hiển thị */
  pageSize?: number
  /** Chữ nghiêng ở dòng đệm đầu tiên khi bảng không có dữ liệu */
  emptyNotice: string
}

/**
 * DataTable có khung cố định `pageSize` dòng (mặc định 10) × `rowHeight` px: thiếu dữ liệu thì bù dòng trống,
 * nhiều hơn thì phân trang — bảng không co/giãn theo lượng dữ liệu (cùng cách HarvestTable).
 */
export default function FixedRowsTable<T>({ columns, rows, getRowKey, onRowClick, rowHeight, pageSize = DEFAULT_PAGE_SIZE, emptyNotice }: FixedRowsTableProps<T>) {
  const [page, setPage] = useState(1)
  // Kẹp trang theo số trang còn lại — lọc/xoá làm ít đi thì không rơi vào trang không tồn tại
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages)

  const displayRows = useMemo<PaddedRow<T>[]>(() => {
    const slice = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
    const out: PaddedRow<T>[] = slice
    for (let i = slice.length; i < pageSize; i += 1) {
      out.push({ placeholder: true, id: `placeholder-${i}`, showNotice: rows.length === 0 && i === 0 })
    }
    return out
  }, [rows, safePage, pageSize])

  const paddedColumns = useMemo<DataTableColumn<PaddedRow<T>>[]>(
    () => columns.map((col, colIndex) => ({
      ...col,
      render: (row, index) => {
        if (!isPlaceholder(row)) return col.render(row, index)
        return colIndex === 0 && row.showNotice ? <span className="text-small italic text-warmGray">{emptyNotice}</span> : null
      },
    })),
    [columns, emptyNotice],
  )

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        columns={paddedColumns}
        rows={displayRows}
        getRowKey={row => (isPlaceholder(row) ? row.id : getRowKey(row))}
        onRowClick={onRowClick ? row => { if (!isPlaceholder(row)) onRowClick(row) } : undefined}
        rowHeight={rowHeight}
      />
      <Pagination page={safePage} limit={pageSize} total={rows.length} onChange={setPage} variant="full" />
    </div>
  )
}
