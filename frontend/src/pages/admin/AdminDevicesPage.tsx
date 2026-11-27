// Mọi thiết bị kèm vị trí; lệnh từ xa trong ngăn chi tiết
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { useSystemNodeStatus } from '@/hooks/shared/useDevices'
import { Button, ClearFiltersButton, EmptyState, SearchInput, SelectMenu, SectionCard } from '@/components/ui'
import StatusTabs from '@/components/common/StatusTabs'
import DataTable from '@/components/ui/DataTable'
import Pagination from '@/components/ui/Pagination'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { buildDeviceColumns } from '@/components/features/admin/devices/deviceColumns'
import { countByStatus, nodePlace, sortDevices, type DeviceTab } from '@/components/features/admin/devices/deviceList.utils'
import { nodeLocation } from '@/lib/deviceLocation'
import { formatRelativeTime } from '@/lib/helpers'
import SimulatedBadge from '@/components/common/SimulatedBadge'
import StatusDot from '@/components/common/StatusDot'
import { t } from '@/i18n'
import DeviceDetailDrawer from '@/components/features/admin/devices/DeviceDetailDrawer'
import type { SystemNodeStatusItem } from '@/types'

const PAGE_SIZE = 10
// px: vừa dòng 2 tầng chữ; mọi dòng kể cả dòng trống bù cao bằng nhau
const ROW_HEIGHT = 64

const TYPE_OPTIONS: { value: SystemNodeStatusItem['type'] | ''; label: string }[] = [
  { value: '', label: 'Tất cả loại' },
  { value: 'sensor', label: 'Bộ điều khiển' },
  { value: 'camera', label: 'Camera đếm chim' },
]

const COLUMNS = buildDeviceColumns()

export default function AdminDevicesPage() {
  const { data, isLoading, isError, refetch } = useSystemNodeStatus()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<DeviceTab>('ALL')
  const [type, setType] = useState<SystemNodeStatusItem['type'] | ''>('')
  const [searchParams] = useSearchParams()
  // ?farm=<tên farm>: trang Nhà yến của Admin mở sẵn đúng farm đang xem
  const [farm, setFarm] = useState(() => searchParams.get('farm') ?? '')
  const [page, setPage] = useState(1)
  const [viewTarget, setViewTarget] = useState<SystemNodeStatusItem | null>(null)

  const nodes = useMemo(() => data?.nodes ?? [], [data])
  const farmOptions = useMemo(
    () => [{ value: '', label: 'Tất cả trang trại' }, ...[...new Set(nodes.map(n => n.farm_name))].sort().map(f => ({ value: f, label: f }))],
    [nodes],
  )

  // Số trên tab tính sau khi lọc trang trại, loại và tìm kiếm; tab chỉ chọn trạng thái
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return nodes
      .filter(n => (!type || n.type === type) && (!farm || n.farm_name === farm))
      .filter(n => !q || n.device_id.toLowerCase().includes(q) || nodeLocation(n).toLowerCase().includes(q))
  }, [nodes, search, type, farm])
  const counts = useMemo(() => countByStatus(scoped), [scoped])
  const filtered = useMemo(() => sortDevices(scoped.filter(n => tab === 'ALL' || n.status === tab)), [scoped, tab])
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Đổi bộ lọc/tìm kiếm thì về trang 1
  function withReset<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1) }
  }

  const hasActiveFilters = !!(search || type || farm)
  function clearFilters() {
    setSearch(''); setType(''); setFarm(''); setPage(1)
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
      {/* Card danh sách duy nhất: tên trang đã ở header nên chỉ có dòng mô tả; số liệu nằm trên hàng tab, tự làm mới mỗi 30 giây (useSystemNodeStatus) */}
      <SectionCard description="Bộ điều khiển và camera đếm chim">
        <StatusTabs
          variant="underline"
          ariaLabel={t('Lọc thiết bị theo trạng thái')}
          value={tab}
          onChange={id => { setTab(id); setPage(1) }}
          tabs={[
            { id: 'ALL', label: `${t('Tất cả')} (${counts.ALL})` },
            { id: 'OFFLINE', label: t('Mất kết nối'), badge: counts.OFFLINE },
            { id: 'PENDING', label: `${t('Chờ kết nối')} (${counts.PENDING})` },
            { id: 'ONLINE', label: `Online (${counts.ONLINE})` },
          ]}
        />

        {/* Tìm kiếm và hai bộ lọc: không có nút tạo, thiết bị mới nhập ở Kho thiết bị, Farm Owner đăng ký từ nhãn */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[14rem] flex-1 sm:max-w-sm">
            <SearchInput placeholder="Tìm mã thiết bị, trang trại, nhà, Zone..." value={search} onChange={withReset(setSearch)} />
          </div>
          <SelectMenu ariaLabel="Lọc theo loại thiết bị" value={type} options={TYPE_OPTIONS} onChange={withReset(setType)} />
          <SelectMenu ariaLabel="Lọc theo trang trại" value={farm} options={farmOptions} onChange={withReset(setFarm)} className="max-w-[16rem]" />
          {hasActiveFilters && <ClearFiltersButton onClick={clearFilters} />}
        </div>

        <DataTable
          columns={COLUMNS}
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
              <p className="text-small text-warmGray">{t(node.type === 'sensor' ? 'Bộ điều khiển' : 'Camera đếm chim')} · {[node.farm_name, nodePlace(node)].filter(Boolean).join(' · ') || '—'}</p>
              <p className="text-small text-warmGray">
                {node.last_heartbeat ? t('Kết nối cuối {{time}}', { time: formatRelativeTime(node.last_heartbeat) }) : t('Chưa từng kết nối')}
              </p>
            </div>
          )}
          rows={rows}
          getRowKey={n => `${n.type}-${n._id}`}
          // Bấm dòng mở ngăn chi tiết (Admin chỉ xem thiết bị)
          onRowClick={setViewTarget}
          // Cố định khung 10 dòng: ít thiết bị/trang cuối vẫn giữ chiều cao, lọc không làm card co giãn
          rowHeight={ROW_HEIGHT}
          minRows={filtered.length > PAGE_SIZE ? PAGE_SIZE : 0}
          emptyMessage={hasActiveFilters || tab !== 'ALL'
            ? 'Không có thiết bị nào khớp bộ lọc. Thử đổi bộ lọc hoặc từ khoá tìm kiếm.'
            : 'Chưa có thiết bị nào. Thiết bị xuất hiện ở đây khi chủ nhà yến hoặc kỹ thuật viên thiết lập từ nhãn QR.'}
        />

        {/* total = số thiết bị SAU khi lọc + tìm kiếm */}
        <Pagination page={page} limit={PAGE_SIZE} total={filtered.length} onChange={setPage} variant="full" />
      </SectionCard>

      <DeviceDetailDrawer node={viewTarget} onClose={() => setViewTarget(null)} />
    </div>
  )
}
