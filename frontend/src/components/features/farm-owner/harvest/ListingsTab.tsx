import { useMemo, useState } from 'react'
import { Badge, Card, DataTable, SelectMenu, SortChips, type DataTableColumn } from '@/components/ui'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import Pagination from '@/components/ui/Pagination'
import { useListingStatsMany } from '@/hooks/farm-owner/useMarketplace'
import { LISTING_STATUS_LABEL, LISTING_STATUS_TONE, DETAIL_BUTTON_CLASS } from '@/components/features/farm-owner/harvest/harvest.constants'
import { formatDateOnly, formatTimeOnly } from '@/lib/helpers'
import type { FlatZone } from '@/hooks/shared/useFarms'
import type { HarvestBatch, ListingStatus, SortDirection } from '@/types'

const PAGE_SIZE = 10
type SortKey = 'date' | 'weight' | 'views' | 'inquiries'
type StatsMap = ReturnType<typeof useListingStatsMany>['statsById']
const DEFAULT_SORT_KEY: SortKey = 'date'
const DEFAULT_SORT_DIR: SortDirection = 'desc'

interface ListingsTabProps {
  batches: HarvestBatch[]
  zones: FlatZone[] | undefined
  onOpenDetail: (batch: HarvestBatch) => void
}

/** Dòng đệm khi trang hiện tại có ít hơn khung tối thiểu — xem padRows bên dưới. */
interface PlaceholderRow {
  id: string
  placeholder: true
  showNotice?: boolean
}
type TableRow = HarvestBatch | PlaceholderRow

function isPlaceholder(row: TableRow): row is PlaceholderRow {
  return 'placeholder' in row
}

// Lượt xem/liên hệ chưa tải xong (hoặc batch chưa có listing_id) tính là 0 khi
// sắp xếp — danh sách sẽ tự sắp lại đúng thứ tự ngay khi stats tải xong.
function getSortValue(b: HarvestBatch, key: SortKey, statsById: StatsMap): number {
  if (key === 'date') return new Date(b.harvest_date).getTime()
  if (key === 'weight') return b.weight_grams
  const stats = statsById.get(b.listing_id!)
  return key === 'views' ? (stats?.view_count ?? 0) : (stats?.inquiry_count ?? 0)
}

// Khung bảng luôn cố định đủ PAGE_SIZE (10) dòng — thiếu thì bù dòng trống,
// không co ngắn lại theo lượng dữ liệu thực tế (cùng quy tắc với HarvestTable).
function padRows(rows: HarvestBatch[]): TableRow[] {
  if (rows.length >= PAGE_SIZE) return rows
  const missing = PAGE_SIZE - rows.length
  const isEmpty = rows.length === 0
  return [
    ...rows,
    ...Array.from({ length: missing }, (_, i): PlaceholderRow => ({ id: `placeholder-${i}`, placeholder: true, showNotice: isEmpty && i === 0 })),
  ]
}

/** ListingsTab – danh sách đợt thu hoạch đã đăng bán (status=LISTED), khung bảng cố định 5/10 dòng như HarvestTable */
export default function ListingsTab({ batches, zones, onOpenDetail }: ListingsTabProps) {
  const [page, setPage] = useState(1)
  const [zoneFilter, setZoneFilter] = useState('')
  const [listingStatusFilter, setListingStatusFilter] = useState<ListingStatus | ''>('')
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT_KEY)
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR)
  const listed = useMemo(() => batches.filter(b => b.status === 'LISTED' && b.listing_id), [batches])

  // Gộp lượt xem/liên hệ/trạng thái của CẢ DANH SÁCH (không chỉ trang hiện tại)
  // thành 1 lần useQueries — cần đủ stats của mọi dòng mới lọc theo Trạng thái
  // tin đăng / sắp xếp theo Lượt xem/Lượt liên hệ được trước khi cắt trang,
  // đồng thời tránh từng ô bảng tự gọi hook riêng cho cùng 1 listing.
  const listingIds = useMemo(() => listed.map(b => b.listing_id!), [listed])
  const { statsById } = useListingStatsMany(listingIds)

  function handleSortChange(key: string) {
    if (key === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key as SortKey); setSortDir('asc') }
    setPage(1)
  }

  const hasActiveFilters = zoneFilter !== '' || listingStatusFilter !== '' || sortKey !== DEFAULT_SORT_KEY || sortDir !== DEFAULT_SORT_DIR

  function clearFilters() {
    setZoneFilter(''); setListingStatusFilter('')
    setSortKey(DEFAULT_SORT_KEY); setSortDir(DEFAULT_SORT_DIR)
    setPage(1)
  }

  const sorted = useMemo(() => {
    const matched = listed.filter(b => {
      if (zoneFilter && b.zone_id !== zoneFilter) return false
      if (listingStatusFilter && statsById.get(b.listing_id!)?.listing_status !== listingStatusFilter) return false
      return true
    })
    const dir = sortDir === 'asc' ? 1 : -1
    return matched.sort((a, b) => (getSortValue(a, sortKey, statsById) - getSortValue(b, sortKey, statsById)) * dir)
  }, [listed, zoneFilter, listingStatusFilter, sortKey, sortDir, statsById])

  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const displayRows = useMemo(() => padRows(pageRows), [pageRows])
  const zoneById = useMemo(() => new Map(zones?.map(z => [z._id, z])), [zones])

  const columns: DataTableColumn<TableRow>[] = [
    {
      key: 'date', header: 'Ngày thu hoạch', className: 'w-[16%] whitespace-nowrap',
      render: row => {
        if (isPlaceholder(row)) {
          return row.showNotice ? <span className="text-sm italic text-warmGray">Chưa có tin đăng bán nào</span> : null
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
      key: 'zone', header: 'Khu vực', className: 'w-[18%]',
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
      key: 'weight', header: 'Sản lượng', className: 'w-[16%]',
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
      key: 'listingStatus', header: 'Trạng thái tin đăng', className: 'w-[14%]',
      render: row => {
        if (isPlaceholder(row)) return null
        const stats = statsById.get(row.listing_id!)
        if (!stats) return <span className="text-sm text-warmGray">…</span>
        return <Badge tone={LISTING_STATUS_TONE[stats.listing_status]}>{LISTING_STATUS_LABEL[stats.listing_status]}</Badge>
      },
    },
    {
      key: 'views', header: 'Lượt xem', align: 'center', className: 'w-[10%]',
      render: row => {
        if (isPlaceholder(row)) return null
        const stats = statsById.get(row.listing_id!)
        return stats ? <span className="font-semibold text-charcoal">{stats.view_count}</span> : <span className="text-sm text-warmGray">…</span>
      },
    },
    {
      key: 'inquiries', header: 'Lượt liên hệ', align: 'center', className: 'w-[10%]',
      render: row => {
        if (isPlaceholder(row)) return null
        const stats = statsById.get(row.listing_id!)
        return stats ? <span className="font-semibold text-charcoal">{stats.inquiry_count}</span> : <span className="text-sm text-warmGray">…</span>
      },
    },
    {
      key: 'actions', header: 'Thao tác', align: 'center', className: 'w-[16%] whitespace-nowrap',
      render: row => {
        if (isPlaceholder(row)) return null
        return (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onOpenDetail(row) }}
            className={DETAIL_BUTTON_CLASS}
          >
            Chi tiết
          </button>
        )
      },
    },
  ]

  return (
    <Card size="lg" className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2 text-charcoal">Tin đăng bán trên Sàn Marketplace</h2>
        <p className="mt-1 text-sm text-warmGray">Theo dõi lượt xem, liên hệ của các đợt thu hoạch đã đăng bán</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SelectMenu
          ariaLabel="Lọc theo khu vực"
          value={zoneFilter}
          onChange={v => { setZoneFilter(v); setPage(1) }}
          options={[{ value: '', label: 'Tất cả khu vực' }, ...(zones ?? []).map(z => ({ value: z._id, label: `${z.houseName} / ${z.name}` }))]}
        />
        <SelectMenu
          ariaLabel="Lọc theo trạng thái tin đăng"
          value={listingStatusFilter}
          onChange={v => { setListingStatusFilter(v); setPage(1) }}
          options={[{ value: '', label: 'Tất cả trạng thái' }, ...(Object.keys(LISTING_STATUS_LABEL) as ListingStatus[]).map(s => ({ value: s, label: LISTING_STATUS_LABEL[s] }))]}
        />
        <SortChips
          fields={[
            { key: 'date', label: 'Ngày thu hoạch' },
            { key: 'weight', label: 'Sản lượng' },
            { key: 'views', label: 'Lượt xem' },
            { key: 'inquiries', label: 'Lượt liên hệ' },
          ]}
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
      <Pagination page={page} limit={PAGE_SIZE} total={sorted.length} onChange={setPage} variant="numbered" />
    </Card>
  )
}
