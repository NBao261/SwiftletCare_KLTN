// ADMIN: /devices: mọi thiết bị kèm farm, nhà, khu vực (GET /devices/system-status); lệnh từ xa trong ngăn chi tiết
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { useSystemNodeStatus } from '@/hooks/shared/useDevices'
import { Button, ClearFiltersButton, EmptyState, SearchInput, SelectMenu, SortChips, SectionCard } from '@/components/ui'
import DataTable from '@/components/ui/DataTable'
import Pagination from '@/components/ui/Pagination'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import DeviceStats from '@/components/features/admin/devices/DeviceStats'
import { buildDeviceColumns } from '@/components/features/admin/devices/deviceColumns'
import { nodeLocation } from '@/lib/deviceLocation'
import { formatRelativeTime } from '@/lib/helpers'
import SimulatedBadge from '@/components/common/SimulatedBadge'
import StatusDot from '@/components/common/StatusDot'
import { t } from '@/i18n'
import DeviceDetailDrawer from '@/components/features/admin/devices/DeviceDetailDrawer'
import type { DeviceStatus, SortDirection, SystemNodeStatusItem } from '@/types'

const PAGE_SIZE = 10
// px: vừa dòng 2 tầng chữ (cột Heartbeat giờ/ngày); mọi dòng kể cả dòng trống bù cao bằng nhau
const ROW_HEIGHT = 64

const STATUS_OPTIONS: { value: DeviceStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'OFFLINE', label: 'Mất kết nối' },
  // ERROR/DEGRADED đã bỏ theo
  { value: 'PENDING', label: 'Chờ kết nối' },
]
const TYPE_OPTIONS: { value: SystemNodeStatusItem['type'] | ''; label: string }[] = [
  { value: '', label: 'Tất cả loại' },
  { value: 'sensor', label: 'Bộ điều khiển' },
  { value: 'camera', label: 'Camera đếm chim' },
]

type DeviceSortKey = 'last_heartbeat' | 'device_id' | 'status'
const SORT_FIELDS: { key: DeviceSortKey; label: string }[] = [
  { key: 'last_heartbeat', label: 'Kết nối cuối' },
  { key: 'device_id', label: 'Tên thiết bị' },
  { key: 'status', label: 'Trạng thái' },
]
// Sắp theo trạng thái: cần chú ý lên trước khi tăng dần; ERROR/DEGRADED đã bỏ
const STATUS_RANK: Record<DeviceStatus, number> = { OFFLINE: 0, PENDING: 1, ONLINE: 2 }
const DEFAULT_SORT_BY: DeviceSortKey = 'last_heartbeat'
const DEFAULT_SORT_DIR: SortDirection = 'desc'

function sortValue(n: SystemNodeStatusItem, key: DeviceSortKey): string | number {
  if (key === 'status') return STATUS_RANK[n.status]
  if (key === 'device_id') return n.device_id.toLowerCase()
  return n.last_heartbeat ?? '' // chưa từng kết nối xếp cuối khi giảm dần
}

export default function AdminDevicesPage() {
  const { data, isLoading, isError, refetch } = useSystemNodeStatus()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<DeviceStatus | ''>('')
  const [type, setType] = useState<SystemNodeStatusItem['type'] | ''>('')
  const [searchParams] = useSearchParams()
  // ?farm=<tên farm>: trang Nhà yến của Admin mở sẵn đúng farm đang xem
  const [farm, setFarm] = useState(() => searchParams.get('farm') ?? '')
  const [sortBy, setSortBy] = useState<DeviceSortKey>(DEFAULT_SORT_BY)
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR)
  const [page, setPage] = useState(1)
  const [viewTarget, setViewTarget] = useState<SystemNodeStatusItem | null>(null)

  const nodes = useMemo(() => data?.nodes ?? [], [data])
  const farmOptions = useMemo(
    () => [{ value: '', label: 'Tất cả trang trại' }, ...[...new Set(nodes.map(n => n.farm_name))].sort().map(f => ({ value: f, label: f }))],
    [nodes],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const dir = sortDir === 'asc' ? 1 : -1
    return nodes
      .filter(n => (!status || n.status === status) && (!type || n.type === type) && (!farm || n.farm_name === farm))
      .filter(n => !q || n.device_id.toLowerCase().includes(q) || nodeLocation(n).toLowerCase().includes(q))
      .sort((a, b) => {
        const va = sortValue(a, sortBy), vb = sortValue(b, sortBy)
        return (va < vb ? -1 : va > vb ? 1 : 0) * dir
      })
  }, [nodes, search, status, type, farm, sortBy, sortDir])
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleSortChange(key: DeviceSortKey) {
    if (key === sortBy) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortDir(key === 'last_heartbeat' ? 'desc' : 'asc') }
    setPage(1)
  }

  // Đổi bộ lọc/tìm kiếm thì về trang 1
  function withReset<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1) }
  }

  const hasActiveFilters = !!(search || status || type || farm) || sortBy !== DEFAULT_SORT_BY || sortDir !== DEFAULT_SORT_DIR
  function clearFilters() {
    setSearch(''); setStatus(''); setType(''); setFarm(''); setSortBy(DEFAULT_SORT_BY); setSortDir(DEFAULT_SORT_DIR); setPage(1)
  }

  if (isLoading) return <LoadingSkeleton count={5} className="h-14 w-full" />
  if (isError || !data) {
    return (
      <EmptyState
        icon={<WarningCircleIcon size={32} />}
        title="Không tải được trạng thái thiết bị"
        description="Kiểm tra kết nối tới máy chủ rồi thử lại."
        action={<Button variant="secondary" size="sm" onClick={() => refetch()}>Thử lại</Button>}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Hàng 0: 4 ô số toàn hệ thống: tự làm mới mỗi 30 giây (useSystemNodeStatus) */}
      <DeviceStats status={data} />

      {/* Card danh sách duy nhất: tên trang đã ở header nên không có tiêu đề */}
      <SectionCard description="Bộ điều khiển và camera đếm chim">

        {/* Hàng 1: tìm kiếm: không có nút tạo: thiết bị mới nhập ở Kho thiết bị, Farm Owner đăng ký từ nhãn */}
        <SearchInput placeholder="Tìm mã thiết bị, trang trại, nhà, Zone..." value={search} onChange={withReset(setSearch)} />

        {/* Hàng 2: bộ lọc + sắp xếp */}
        <div className="flex flex-wrap items-center gap-3">
          <SelectMenu ariaLabel="Lọc theo trạng thái" value={status} options={STATUS_OPTIONS} onChange={withReset(setStatus)} />
          <SelectMenu ariaLabel="Lọc theo loại thiết bị" value={type} options={TYPE_OPTIONS} onChange={withReset(setType)} />
          <SelectMenu ariaLabel="Lọc theo trang trại" value={farm} options={farmOptions} onChange={withReset(setFarm)} className="max-w-[16rem]" />
          <SortChips fields={SORT_FIELDS} sortBy={sortBy} sortDir={sortDir} onChange={handleSortChange} />
          {hasActiveFilters && <ClearFiltersButton onClick={clearFilters} />}
        </div>

        <DataTable
          columns={buildDeviceColumns(setViewTarget)}
          // Bấm thẻ mở ngăn chi tiết như bấm dòng
          mobileCard={node => (
            <div className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2 text-body font-semibold text-charcoal">
                  <span className="truncate">{node.device_id}</span>
                  <SimulatedBadge simulated={node.simulated} />
                </p>
                <StatusDot status={node.status} colored />
              </div>
              <p className="text-small text-warmGray">{t(node.type === 'sensor' ? 'Bộ điều khiển' : 'Camera đếm chim')} · {nodeLocation(node) || '—'}</p>
              <p className="text-small text-warmGray">
                {node.last_heartbeat ? t('Kết nối cuối {{time}}', { time: formatRelativeTime(node.last_heartbeat) }) : t('Chưa từng kết nối')}
              </p>
            </div>
          )}
          rows={rows}
          getRowKey={n => `${n.type}-${n._id}`}
          // Bấm dòng hoặc nút "Chi tiết" mở drawer chi tiết (Admin chỉ xem thiết bị)
          onRowClick={setViewTarget}
          // Cố định khung 10 dòng: ít thiết bị/trang cuối vẫn giữ chiều cao, lọc không làm card co giãn
          rowHeight={ROW_HEIGHT}
          minRows={filtered.length > PAGE_SIZE ? PAGE_SIZE : 0}
          emptyMessage={hasActiveFilters
            ? 'Không có thiết bị nào khớp bộ lọc. Thử đổi bộ lọc hoặc từ khoá tìm kiếm.'
            : 'Chưa có thiết bị nào. Thiết bị xuất hiện ở đây khi chủ nhà yến đăng ký từ nhãn QR.'}
        />

        {/* total = số thiết bị SAU khi lọc + tìm kiếm */}
        <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onChange={setPage} variant="full" />
      </SectionCard>

      <DeviceDetailDrawer node={viewTarget} onClose={() => setViewTarget(null)} />
    </div>
  )
}
