import { useMemo, useState } from 'react'
import { Badge, Card, DataTable, SearchInput, SelectMenu, SortChips, type DataTableColumn } from '@/components/ui'
import ActionsMenu from '@/components/ui/ActionsMenu'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import Pagination from '@/components/ui/Pagination'
import { NEST_TYPE_LABEL, HARVEST_STATUS_TONE, HARVEST_STATUS_LABEL } from '@/components/features/farm-owner/harvest/harvest.constants'
import { formatDateOnly, formatTimeOnly } from '@/lib/helpers'
import type { FlatZone } from '@/hooks/shared/useFarms'
import type { HarvestBatch, HarvestStatus, NestType, SortDirection } from '@/types'

const PAGE_SIZE = 10
type SortKey = 'date' | 'weight'
const SORT_VALUE: Record<SortKey, (b: HarvestBatch) => number> = {
  date: b => new Date(b.harvest_date).getTime(),
  weight: b => b.weight_grams,
}
const DEFAULT_SORT_KEY: SortKey = 'date'
const DEFAULT_SORT_DIR: SortDirection = 'desc'

interface HarvestTableProps {
  batches: HarvestBatch[]
  zones: FlatZone[] | undefined
  zoneNameById: Map<string, string>
  onOpenDetail: (batch: HarvestBatch) => void
  onEdit: (batch: HarvestBatch) => void
  onDelete: (batch: HarvestBatch) => void
  onCreateListing: (batch: HarvestBatch) => void
}

/** Dòng đệm khi trang hiện tại có ít hơn PAGE_SIZE bản ghi — giữ khung bảng cao cố định 10 dòng thay vì co ngắn lại. */
interface PlaceholderRow {
  id: string
  placeholder: true
  /** Chỉ dòng đệm đầu tiên hiện chữ thông báo khi hoàn toàn không có bản ghi nào */
  showNotice?: boolean
}
type TableRow = HarvestBatch | PlaceholderRow

function isPlaceholder(row: TableRow): row is PlaceholderRow {
  return 'placeholder' in row
}

// Khung bảng luôn cố định đủ PAGE_SIZE (10) dòng — thiếu thì bù dòng trống,
// không co ngắn lại theo lượng dữ liệu thực tế.
function padRows(rows: HarvestBatch[]): TableRow[] {
  if (rows.length >= PAGE_SIZE) return rows
  const missing = PAGE_SIZE - rows.length
  const isEmpty = rows.length === 0
  return [
    ...rows,
    ...Array.from({ length: missing }, (_, i): PlaceholderRow => ({ id: `placeholder-${i}`, placeholder: true, showNotice: isEmpty && i === 0 })),
  ]
}

/** HarvestTable – tìm kiếm/lọc/phân trang trên danh sách Harvest Batch đã fetch (API không hỗ trợ phân trang server), khung bảng cố định 10 dòng */
export default function HarvestTable({
  batches, zones, zoneNameById, onOpenDetail, onEdit, onDelete, onCreateListing,
}: HarvestTableProps) {
  const [search, setSearch] = useState('')
  const [zoneFilter, setZoneFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<HarvestStatus | ''>('')
  const [nestTypeFilter, setNestTypeFilter] = useState<NestType | ''>('')
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT_KEY)
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR)

  // Đổi tiêu chí sắp xếp thì về trang 1 (cùng quy ước với AdminUsersPage) — bấm
  // lại đúng cột đang sort thì chỉ đảo chiều, không reset về asc.
  function handleSortChange(key: string) {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key as SortKey); setSortDir('asc') }
    setPage(1)
  }

  const hasActiveFilters = search !== '' || zoneFilter !== '' || statusFilter !== '' || nestTypeFilter !== ''
    || sortKey !== DEFAULT_SORT_KEY || sortDir !== DEFAULT_SORT_DIR

  function clearFilters() {
    setSearch(''); setZoneFilter(''); setStatusFilter(''); setNestTypeFilter('')
    setSortKey(DEFAULT_SORT_KEY); setSortDir(DEFAULT_SORT_DIR)
    setPage(1)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matched = batches.filter(b => {
      if (zoneFilter && b.zone_id !== zoneFilter) return false
      if (statusFilter && b.status !== statusFilter) return false
      if (nestTypeFilter && b.nest_type !== nestTypeFilter) return false
      // Không tìm theo trace_code: mã đã bị ẩn khỏi UI, dò từng ký tự rồi xem có dòng khớp sẽ lộ mã gián tiếp
      if (q && !(zoneNameById.get(b.zone_id) ?? '').toLowerCase().includes(q)) return false
      return true
    })
    const dir = sortDir === 'asc' ? 1 : -1
    const value = SORT_VALUE[sortKey]
    return matched.sort((a, b) => (value(a) - value(b)) * dir)
  }, [batches, zoneFilter, statusFilter, nestTypeFilter, search, zoneNameById, sortKey, sortDir])

  // Kẹp trang theo số trang còn lại — xoá bản ghi cuối của trang cuối (refetch) không
  // làm bảng rơi vào trang không tồn tại rồi hiện rỗng dù trang trước vẫn có dữ liệu.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const displayRows = useMemo(() => padRows(pageRows), [pageRows])
  const zoneById = useMemo(() => new Map(zones?.map(z => [z._id, z])), [zones])

  // Mã truy xuất (trace_code) không hiện trong bảng quản lý nội bộ này — chỉ lộ
  // ra dạng mã QR khi Farm Owner chủ động bấm "Chi tiết" (TraceCodeRow), đúng
  // mục đích công khai cho khách qua QR, không phải để lẫn trong danh sách.
  const columns: DataTableColumn<TableRow>[] = [
    {
      key: 'date', header: 'Ngày thu hoạch', className: 'w-[15%] whitespace-nowrap',
      render: row => {
        if (isPlaceholder(row)) {
          return row.showNotice ? <span className="text-sm italic text-warmGray">Chưa có nhật ký thu hoạch trong kỳ này</span> : null
        }
        return (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-charcoal">{formatDateOnly(row.harvest_date)}</span>
            <span className="mt-0.5 text-xs text-warmGray">{formatTimeOnly(row.harvest_date)}</span>
          </div>
        )
      },
    },
    {
      key: 'zone', header: 'Khu vực', className: 'w-[20%]',
      render: row => {
        if (isPlaceholder(row)) return null
        const zone = zoneById.get(row.zone_id)
        return (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-charcoal">{zone?.name ?? '—'}</span>
            <span className="mt-0.5 text-xs text-warmGray">{zone?.houseName ?? ''}</span>
          </div>
        )
      },
    },
    {
      key: 'nestType', header: 'Loại tổ', className: 'w-[14%]',
      render: row => (isPlaceholder(row) ? null : <span className="text-charcoal">{NEST_TYPE_LABEL[row.nest_type]}</span>),
    },
    {
      key: 'weight', header: 'Sản lượng', className: 'w-[17%]',
      render: row => {
        if (isPlaceholder(row)) return null
        return (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-charcoal">{row.nest_count.toLocaleString('vi-VN')} tổ</span>
            <span className="mt-0.5 text-xs text-warmGray">{(row.weight_grams / 1000).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</span>
          </div>
        )
      },
    },
    {
      key: 'status', header: 'Trạng thái', className: 'w-[14%]',
      render: row => (isPlaceholder(row) ? null : <Badge tone={HARVEST_STATUS_TONE[row.status]}>{HARVEST_STATUS_LABEL[row.status]}</Badge>),
    },
    {
      key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[20%] whitespace-nowrap',
      render: row => {
        if (isPlaceholder(row)) return null
        return (
          // stopPropagation — hàng đã bấm-được (onRowClick), không cho mở menu kích hoạt luôn điều hướng
          <div onClick={e => e.stopPropagation()} className="flex items-center justify-center">
            <ActionsMenu
              items={row.status === 'DRAFT' ? [
                { label: 'Chi tiết', onClick: () => onOpenDetail(row) },
                { label: 'Sửa', onClick: () => onEdit(row) },
                { label: 'Đăng bán', onClick: () => onCreateListing(row) },
                { label: 'Xóa', onClick: () => onDelete(row), danger: true },
              ] : [
                { label: 'Chi tiết', onClick: () => onOpenDetail(row) },
              ]}
            />
          </div>
        )
      },
    },
  ]

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2 text-charcoal">Biên bản thu hoạch</h2>
        <p className="mt-1 text-sm text-warmGray">Danh sách đợt thu hoạch, truy xuất nguồn gốc theo Zone</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <SearchInput placeholder="Tìm theo khu vực..." value={search} onChange={v => { setSearch(v); setPage(1) }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SelectMenu
          ariaLabel="Lọc theo khu vực"
          value={zoneFilter}
          onChange={v => { setZoneFilter(v); setPage(1) }}
          options={[{ value: '', label: 'Tất cả khu vực' }, ...(zones ?? []).map(z => ({ value: z._id, label: `${z.houseName} / ${z.name}` }))]}
        />
        <SelectMenu
          ariaLabel="Lọc theo loại tổ"
          value={nestTypeFilter}
          onChange={v => { setNestTypeFilter(v); setPage(1) }}
          options={[{ value: '', label: 'Tất cả loại tổ' }, ...(Object.keys(NEST_TYPE_LABEL) as NestType[]).map(t => ({ value: t, label: NEST_TYPE_LABEL[t] }))]}
        />
        <SelectMenu
          ariaLabel="Lọc theo trạng thái"
          value={statusFilter}
          onChange={v => { setStatusFilter(v); setPage(1) }}
          options={[{ value: '', label: 'Tất cả trạng thái' }, ...(Object.keys(HARVEST_STATUS_LABEL) as HarvestStatus[]).map(s => ({ value: s, label: HARVEST_STATUS_LABEL[s] }))]}
        />
        <SortChips
          fields={[{ key: 'date', label: 'Ngày thu hoạch' }, { key: 'weight', label: 'Sản lượng' }]}
          sortBy={sortKey}
          sortDir={sortDir}
          onChange={handleSortChange}
        />
        {hasActiveFilters && <ClearFiltersButton onClick={clearFilters} />}
      </div>

      <DataTable
        columns={columns}
        rows={displayRows}
        getRowKey={row => (isPlaceholder(row) ? row.id : row._id)}
        onRowClick={row => { if (!isPlaceholder(row)) onOpenDetail(row) }}
        rowHeight={68}
      />
      <Pagination page={safePage} limit={PAGE_SIZE} total={filtered.length} onChange={setPage} variant="numbered" />
    </Card>
  )
}
