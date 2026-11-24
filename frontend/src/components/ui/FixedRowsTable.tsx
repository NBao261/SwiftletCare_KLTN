import { useMemo, useState, type ReactNode } from 'react'
import DataTable, { type DataTableColumn } from '@/components/ui/DataTable'
import Pagination, { type PaginationLabels } from '@/components/ui/Pagination'

const DEFAULT_PAGE_SIZE = 10
// Bảng rỗng cao bằng chừng này dòng: đủ chỗ cho hình minh hoạ trạng thái rỗng, không chiếm cả trang
const EMPTY_ROWS = 4

interface PlaceholderRow {
  placeholder: true
  id: string
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
  // px: chiều cao cứng của mỗi dòng
  rowHeight: number
  // Số dòng mỗi trang = số dòng khung bảng luôn hiển thị
  pageSize?: number
  // Chữ hiện giữa khung bảng khi trống và không truyền emptyContent
  emptyNotice: string
  // Nội dung trạng thái rỗng thay cho chữ (VD common/TableEmptyState), đặt giữa khung bảng
  emptyContent?: ReactNode
  // Chữ của thanh phân trang theo ngôn ngữ màn gọi: bỏ trống thì tiếng Việt
  paginationLabels?: PaginationLabels
  // Phân trang ở server: rows đã là dữ liệu của trang hiện tại, tổng số và đổi trang do màn gọi quản lý
  serverPagination?: { page: number; total: number; onChange: (page: number) => void }
  // Điện thoại: danh sách thẻ thay bảng (DataTable mobileCard)
  mobileCard?: (row: T) => ReactNode
}

// Từ 2 trang trở lên thì trang cuối bù dòng trống
export default function FixedRowsTable<T>({ columns, rows, getRowKey, onRowClick, rowHeight, pageSize = DEFAULT_PAGE_SIZE, emptyNotice, emptyContent, paginationLabels, serverPagination, mobileCard }: FixedRowsTableProps<T>) {
  const [page, setPage] = useState(1)
  // Kẹp trang theo số trang còn lại: lọc/xoá làm ít đi thì không rơi vào trang không tồn tại
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages)

  const totalRows = serverPagination?.total ?? rows.length
  const hasManyPages = totalRows > pageSize

  const displayRows = useMemo<PaddedRow<T>[]>(() => {
    const slice = serverPagination ? rows.slice(0, pageSize) : rows.slice((safePage - 1) * pageSize, safePage * pageSize)
    const out: PaddedRow<T>[] = [...slice]
    // Bảng rỗng: 1 dòng đệm: không kẻ vạch chia, chỉ hiện trạng thái rỗng ở giữa
    if (slice.length === 0) return [{ placeholder: true, id: 'placeholder-empty' }]
    if (!hasManyPages) return out
    for (let i = slice.length; i < pageSize; i += 1) {
      out.push({ placeholder: true, id: `placeholder-${i}` })
    }
    return out
  }, [rows, safePage, pageSize, serverPagination, hasManyPages])

  const paddedColumns = useMemo<DataTableColumn<PaddedRow<T>>[]>(
    () => columns.map(col => ({
      ...col,
      render: (row, index) => {
        if (!isPlaceholder(row)) return col.render(row, index)
        return null
      },
    })),
    [columns],
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Bảng rỗng: thông báo nằm giữa khung bảng, không nhét vào ô cột đầu */}
      <div className="relative">
      <DataTable
        columns={paddedColumns}
        rows={displayRows}
        getRowKey={row => (isPlaceholder(row) ? row.id : getRowKey(row))}
        onRowClick={onRowClick ? row => { if (!isPlaceholder(row)) onRowClick(row) } : undefined}
        rowHeight={rows.length === 0 ? rowHeight * Math.min(pageSize, EMPTY_ROWS) : rowHeight}
        mobileCard={mobileCard ? row => (isPlaceholder(row) ? null : mobileCard(row)) : undefined}
        // Bảng rỗng: chữ rỗng nằm ở lớp phủ bên dưới, khung thẻ điện thoại để trống
        emptyMessage=""
      />
      {rows.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          {emptyContent ?? <p className="text-small italic text-warmGray">{emptyNotice}</p>}
        </div>
      )}
      </div>
      <Pagination
        page={serverPagination?.page ?? safePage}
        limit={pageSize}
        total={totalRows}
        onChange={serverPagination?.onChange ?? setPage}
        variant="full"
        labels={paginationLabels}
      />
    </div>
  )
}
