// ADMIN — Thiết bị toàn hệ thống, CHỈ XEM (OPS-NFR-004, GET /devices/system-status). Theo SRS, Admin không quản lý
// thiết bị: kích hoạt/gán/dời là việc của Technician (FARM-FR-003/007/007b, RACI Admin = "I (audit)"), bật/tắt relay
// là việc của Farm Owner/Technician (ENV-FR-016, RACI Admin = "–"). Vì vậy trang này thay cho /devices (màn làm việc
// của Technician) trong menu Admin: không nút kích hoạt, không điều khiển relay, không dời Zone.
// Cùng khuôn trang Ticket/Người dùng: hàng ô số → tìm kiếm → bộ lọc + sắp xếp → bảng → phân trang (client-side trên
// toàn bộ node vì API trả hết 1 lần).
import { useMemo, useState } from 'react'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { useSystemNodeStatus } from '@/hooks/shared/useDevices'
import { Button, ClearFiltersButton, EmptyState, SearchInput, SelectMenu, SortChips } from '@/components/ui'
import DataTable from '@/components/ui/DataTable'
import Pagination from '@/components/ui/Pagination'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import DeviceStats from '@/components/features/admin/devices/DeviceStats'
import { buildDeviceColumns, nodeLocation } from '@/components/features/admin/devices/deviceColumns'
import type { DeviceStatus, SortDirection, SystemNodeStatusItem } from '@/types'

const PAGE_SIZE = 10

const STATUS_OPTIONS: { value: DeviceStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'OFFLINE', label: 'Offline' },
  { value: 'ERROR', label: 'Lỗi' },
  { value: 'DEGRADED', label: 'Suy giảm' },
  { value: 'PENDING', label: 'Chờ kết nối' },
]
const TYPE_OPTIONS: { value: SystemNodeStatusItem['type'] | ''; label: string }[] = [
  { value: '', label: 'Tất cả loại' },
  { value: 'sensor', label: 'Cảm biến' },
  { value: 'camera', label: 'Camera' },
]

type DeviceSortKey = 'last_heartbeat' | 'device_id' | 'status'
const SORT_FIELDS: { key: DeviceSortKey; label: string }[] = [
  { key: 'last_heartbeat', label: 'Heartbeat' },
  { key: 'device_id', label: 'Tên thiết bị' },
  { key: 'status', label: 'Trạng thái' },
]
/** Sắp theo trạng thái: cần chú ý lên trước khi tăng dần */
const STATUS_RANK: Record<DeviceStatus, number> = { ERROR: 0, DEGRADED: 1, OFFLINE: 2, PENDING: 3, ONLINE: 4 }
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
  const [farm, setFarm] = useState('')
  const [sortBy, setSortBy] = useState<DeviceSortKey>(DEFAULT_SORT_BY)
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR)
  const [page, setPage] = useState(1)

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

  /** Đổi bộ lọc/tìm kiếm thì về trang 1 */
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
      {/* Hàng 0: 5 ô số toàn hệ thống — tự làm mới mỗi 30 giây (useSystemNodeStatus) */}
      <DeviceStats status={data} />

      {/* Hàng 1: tìm kiếm — không có nút tạo: kích hoạt thiết bị là việc của Technician */}
      <SearchInput placeholder="Tìm mã thiết bị, trang trại, nhà, phòng..." value={search} onChange={withReset(setSearch)} />

      {/* Hàng 2: bộ lọc + sắp xếp */}
      <div className="flex flex-wrap items-center gap-3">
        <SelectMenu ariaLabel="Lọc theo trạng thái" value={status} options={STATUS_OPTIONS} onChange={withReset(setStatus)} />
        <SelectMenu ariaLabel="Lọc theo loại thiết bị" value={type} options={TYPE_OPTIONS} onChange={withReset(setType)} />
        <SelectMenu ariaLabel="Lọc theo trang trại" value={farm} options={farmOptions} onChange={withReset(setFarm)} className="max-w-[16rem]" />
        <SortChips fields={SORT_FIELDS} sortBy={sortBy} sortDir={sortDir} onChange={handleSortChange} />
        {hasActiveFilters && <ClearFiltersButton onClick={clearFilters} />}
      </div>

      <DataTable
        columns={buildDeviceColumns((page - 1) * PAGE_SIZE)}
        rows={rows}
        getRowKey={n => `${n.type}-${n._id}`}
        emptyMessage={hasActiveFilters
          ? 'Không có thiết bị nào khớp bộ lọc — thử đổi bộ lọc hoặc từ khoá tìm kiếm.'
          : 'Chưa có thiết bị nào — thiết bị xuất hiện ở đây khi Technician kích hoạt qua Web Console Onboarding.'}
      />

      {/* total = số thiết bị SAU khi lọc + tìm kiếm */}
      <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onChange={setPage} variant="full" />
    </div>
  )
}
