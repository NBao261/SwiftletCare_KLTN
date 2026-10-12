// TechnicianMaintenancePage — TICKET-FR-013: lịch bảo trì định kỳ theo Farm.
// Đến hạn, job backend tự tạo ticket MAINTENANCE (sớm vài ngày) rồi dời hạn sang chu kỳ kế tiếp.
// Technician/Admin: tạo · sửa · tạm dừng · xoá. Farm Owner chỉ xem (BE requireRole).
// Cùng khuôn với các trang danh sách của Admin: DataTable + Badge + ActionsMenu + ConfirmModal.
import { useMemo, useState } from 'react'
import { Button, Badge, DataTable, EmptyState, SelectMenu, ConfirmModal, ActionsMenu, SectionCard, type DataTableColumn, type ActionsMenuItem } from '@/components/ui'
import { Plus, Search } from 'lucide-react'
import ClearFiltersButton from '@/components/ui/ClearFiltersButton'
import FilterChip from '@/components/ui/FilterChip'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import Pagination from '@/components/ui/Pagination'
import MaintenanceScheduleModal from '@/components/features/technician/maintenance/MaintenanceScheduleModal'
import { usePermission } from '@/hooks/common/usePermission'
import { useFarms, useAllZones } from '@/hooks/shared/useFarms'
import {
  useMaintenanceSchedules, useUpdateMaintenanceSchedule, useDeleteMaintenanceSchedule,
} from '@/hooks/shared/useMaintenanceSchedules'
import { useToastStore } from '@/stores/toastStore'
import { formatDate, getApiErrorMessage } from '@/lib/helpers'
import type { MaintenanceSchedule } from '@/types'

const ALL_FARMS = ''
// Khớp mặc định BE (limit 20) — gửi tường minh để không phụ thuộc default phía server
const PAGE_SIZE = 20

type StatusFilter = '' | 'due' | 'soon' | 'later' | 'paused'
type SortKey = 'next_asc' | 'next_desc' | 'interval_asc' | 'interval_desc' | 'name_asc'

const DUE_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'due', label: 'Đến hạn' },
  { value: 'soon', label: 'Sắp đến hạn' },
  { value: 'later', label: 'Chưa đến hạn' },
  { value: 'paused', label: 'Tạm dừng' },
]
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'next_asc', label: 'Lần kế tiếp: sớm nhất' },
  { value: 'next_desc', label: 'Lần kế tiếp: muộn nhất' },
  { value: 'interval_asc', label: 'Chu kỳ: ngắn → dài' },
  { value: 'interval_desc', label: 'Chu kỳ: dài → ngắn' },
  { value: 'name_asc', label: 'Nội dung: A → Z' },
]

const DEFAULT_SORT: SortKey = 'next_asc'
const DAY_MS = 86_400_000

const ACCENT_CLS: Record<Exclude<StatusFilter, ''>, string> = {
  due: 'bg-climateOrange',
  soon: 'bg-success',
  later: 'bg-transparent',
  paused: 'bg-transparent',
}

/** Nhóm theo hạn: tạm dừng → đến hạn (next_due_at ≤ now) → trong 7 ngày → sau đó */
function scheduleStatus(s: MaintenanceSchedule): Exclude<StatusFilter, ''> {
  if (!s.is_active) return 'paused'
  const diff = new Date(s.next_due_at).getTime() - Date.now()
  if (diff <= 0) return 'due'
  return diff <= 7 * DAY_MS ? 'soon' : 'later'
}

/** Chữ tương đối "Còn N ngày / Quá hạn N ngày" từ next_due_at thật — không suy diễn lịch lặp */
function dueInfo(s: MaintenanceSchedule): { text: string; cls: string } {
  const diff = new Date(s.next_due_at).getTime() - Date.now()
  if (!s.is_active) return { text: 'Tạm dừng', cls: 'font-medium text-warmGray' }
  if (diff <= 0) {
    const days = Math.floor(-diff / DAY_MS)
    return { text: days === 0 ? 'Đến hạn hôm nay' : `Quá hạn ${days} ngày`, cls: 'font-semibold text-climateOrange' }
  }
  const days = Math.ceil(diff / DAY_MS)
  return { text: `Còn ${days} ngày`, cls: days <= 7 ? 'font-semibold text-charcoal' : 'font-medium text-warmGray' }
}

export default function TechnicianMaintenancePage() {
  // BE: GET cho FARM_OWNER/TECHNICIAN/ADMIN; POST/PUT/DELETE chỉ TECHNICIAN/ADMIN
  const canManage = usePermission('TECHNICIAN', 'ADMIN')
  const push = useToastStore(s => s.push)

  const [farmId, setFarmId] = useState(ALL_FARMS)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [sortKey, setSortKey] = useState<SortKey>('next_asc')
  const { data: farms } = useFarms()
  const { data: zones } = useAllZones()
  const { records: schedules, total, isLoading, isError } = useMaintenanceSchedules(farmId || undefined, page, PAGE_SIZE)
  const updateSchedule = useUpdateMaintenanceSchedule()
  const deleteSchedule = useDeleteMaintenanceSchedule()

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<MaintenanceSchedule | undefined>()
  const [deleting, setDeleting] = useState<MaintenanceSchedule | undefined>()

  const visibleSchedules = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = (schedules ?? []).filter(s =>
      (!statusFilter || scheduleStatus(s) === statusFilter) &&
      (!q || s.description.toLowerCase().includes(q)),
    )
    const time = (s: MaintenanceSchedule) => new Date(s.next_due_at).getTime()
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'next_desc': return time(b) - time(a)
        case 'interval_asc': return a.interval_days - b.interval_days
        case 'interval_desc': return b.interval_days - a.interval_days
        case 'name_asc': return a.description.localeCompare(b.description, 'vi')
        default: return time(a) - time(b)
      }
    })
  }, [schedules, search, statusFilter, sortKey])
  const dueCounts = useMemo(() => {
    const c = { due: 0, soon: 0, later: 0, paused: 0 }
    for (const s of schedules ?? []) c[scheduleStatus(s)]++
    return c
  }, [schedules])
  const hasFilter = !!search || !!statusFilter || !!farmId || sortKey !== DEFAULT_SORT
  function clearFilters() {
    setSearch('')
    setStatusFilter('')
    setFarmId(ALL_FARMS)
    setSortKey(DEFAULT_SORT)
    setPage(1)
  }

  const farmName = useMemo(() => new Map((farms ?? []).map(f => [f._id, f.name])), [farms])
  const zoneName = useMemo(
    () => new Map((zones ?? []).map(z => [z._id, `${z.houseName} · ${z.name}`])),
    [zones],
  )
  const farmOptions = useMemo(
    () => [{ value: ALL_FARMS, label: 'Mọi trang trại' }, ...(farms ?? []).map(f => ({ value: f._id, label: f.name }))],
    [farms],
  )

  function toggleActive(s: MaintenanceSchedule) {
    updateSchedule.mutate({ id: s._id, input: { is_active: !s.is_active } }, {
      onSuccess: () => push(s.is_active ? 'Đã tạm dừng lịch bảo trì' : 'Đã kích hoạt lại lịch bảo trì'),
      onError: (err) => push(getApiErrorMessage(err, 'Cập nhật lịch bảo trì thất bại'), 'error'),
    })
  }

  function confirmDelete() {
    if (!deleting) return
    deleteSchedule.mutate(deleting._id, {
      onSuccess: () => { 
        push('Đã xoá lịch bảo trì')
        setDeleting(undefined)
        // Nếu xóa phần tử cuối cùng của trang hiện tại (và không phải trang 1), thì lùi trang
        if (schedules.length === 1 && page > 1) {
          setPage(p => p - 1)
        }
      },
      onError: (err) => push(getApiErrorMessage(err, 'Xoá lịch bảo trì thất bại'), 'error'),
    })
  }

  const columns: DataTableColumn<MaintenanceSchedule>[] = [
    {
      key: 'stt', header: 'STT', align: 'center', className: 'relative w-[6%]',
      render: (s, index) => (
        <>
          {/* Viền trái theo hạn: đến hạn = cam, sắp tới (≤7 ngày) = xanh, còn lại/tạm dừng = không viền */}
          <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${ACCENT_CLS[scheduleStatus(s)]}`} />
          <span className="text-warmGray">{(page - 1) * PAGE_SIZE + index + 1}</span>
        </>
      ),
    },
    {
      key: 'description', header: 'Nội dung', className: 'w-[28%]',
      render: s => <p className="line-clamp-2 font-semibold text-charcoal" title={s.description}>{s.description}</p>,
    },
    {
      key: 'farm', header: 'Trang trại · Zone', className: 'w-[20%]',
      render: s => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-charcoal">{farmName.get(s.farm_id) ?? '—'}</p>
          <p className="truncate text-xs text-warmGray">{s.zone_id ? (zoneName.get(s.zone_id) ?? 'Zone') : 'Toàn trang trại'}</p>
        </div>
      ),
    },
    { key: 'interval', header: 'Chu kỳ', className: 'w-[10%] whitespace-nowrap', render: s => <span className="tabular-nums text-charcoal">{s.interval_days} ngày</span> },
    {
      key: 'next', header: 'Lần kế tiếp', className: 'w-[16%] whitespace-nowrap',
      render: s => {
        const info = dueInfo(s)
        return (
          <div className="leading-tight">
            <p className={`tabular-nums ${info.cls}`}>{info.text}</p>
            <p className="mt-0.5 text-xs tabular-nums text-warmGray">{formatDate(s.next_due_at)}</p>
          </div>
        )
      },
    },
    {
      key: 'status', header: 'Trạng thái', className: 'w-[12%]',
      render: s => !s.is_active
        ? <Badge tone="neutral" className="whitespace-nowrap">Tạm dừng</Badge>
        : new Date(s.next_due_at).getTime() <= Date.now()
          ? <Badge tone="warning" className="whitespace-nowrap">Đến hạn</Badge>
          : <Badge tone="positive" className="whitespace-nowrap">Đang chạy</Badge>,
    },
    ...(canManage ? [{
      key: 'actions', header: 'Thao tác', align: 'center' as const, className: 'w-[8%]',
      render: (s: MaintenanceSchedule) => {
        const items: ActionsMenuItem[] = [
          { label: 'Sửa', onClick: () => setEditing(s) },
          { label: s.is_active ? 'Tạm dừng' : 'Kích hoạt lại', onClick: () => toggleActive(s) },
          { label: 'Xoá', onClick: () => setDeleting(s), danger: true },
        ]
        return <ActionsMenu items={items} />
      },
    }] : []),
  ]

  return (
    <div className="flex flex-col gap-5">
      <SectionCard title="Danh sách lịch bảo trì" description="Lịch bảo trì định kỳ theo trang trại — đến hạn hệ thống tự tạo ticket">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <label className="relative w-full max-w-xs">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-warmGray" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm theo nội dung…"
                aria-label="Tìm lịch bảo trì"
                className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-charcoal outline-none focus:border-gray-400"
              />
            </label>
            <SelectMenu ariaLabel="Lọc theo trang trại" value={farmId} options={farmOptions} onChange={v => { setFarmId(v); setPage(1) }} />
            <SelectMenu ariaLabel="Sắp xếp" value={sortKey} options={SORT_OPTIONS} onChange={v => setSortKey(v as SortKey)} />
            {hasFilter && <ClearFiltersButton onClick={clearFilters} />}
          </div>
          {canManage && <Button onClick={() => setShowCreate(true)}><Plus size={18} strokeWidth={2} /> Tạo lịch bảo trì</Button>}
        </div>

        {/* Nhóm theo hạn — chip có số đếm (tính trên các lịch của trang đang xem) */}
        {!isLoading && !isError && !!schedules?.length && (
          <div className="flex flex-wrap items-center gap-2">
            {DUE_CHIPS.map(c => (
              <FilterChip
                key={c.value || 'all'}
                active={statusFilter === c.value}
                label={<span className="tabular-nums">{c.label} · {c.value ? dueCounts[c.value] : schedules.length}</span>}
                onClick={() => setStatusFilter(c.value)}
              />
            ))}
          </div>
        )}

        {isLoading && <LoadingSkeleton count={3} className="h-14 w-full" />}

        {isError && (
          <EmptyState title="Không tải được lịch bảo trì" description="Kiểm tra kết nối rồi tải lại trang." />
        )}

        {!isLoading && !isError && schedules?.length === 0 && (
          <EmptyState
            title="Chưa có lịch bảo trì nào"
            description={canManage
              ? 'Tạo lịch để hệ thống tự sinh ticket bảo trì đúng chu kỳ cho trang trại.'
              : 'Kỹ thuật viên SwiftletCare sẽ lên lịch bảo trì định kỳ cho trang trại của bạn.'}
            action={canManage ? <Button onClick={() => setShowCreate(true)}><Plus size={18} strokeWidth={2} /> Tạo lịch bảo trì</Button> : undefined}
          />
        )}

        {!isLoading && !isError && !!schedules?.length && hasFilter && visibleSchedules.length === 0 && (
          <EmptyState title="Không có lịch phù hợp" description="Thử đổi từ khóa hoặc bộ lọc (chỉ lọc trong trang hiện tại)." />
        )}

        {!isLoading && !isError && !!schedules?.length && visibleSchedules.length > 0 && (
          <>
            <DataTable
              columns={columns}
              rows={visibleSchedules}
              getRowKey={s => s._id}
              emptyMessage="Chưa có lịch bảo trì nào"
            />
            <Pagination page={page} limit={PAGE_SIZE} total={total} onChange={setPage} variant="full" />
          </>
        )}
      </SectionCard>

      {canManage && (
        <>
          <MaintenanceScheduleModal open={showCreate} onClose={() => setShowCreate(false)} defaultFarmId={farmId || undefined} />
          <MaintenanceScheduleModal open={editing !== undefined} onClose={() => setEditing(undefined)} schedule={editing} />
          <ConfirmModal
            open={deleting !== undefined}
            title="Xoá lịch bảo trì"
            description={`Xoá lịch "${deleting ? deleting.description.slice(0, 80) : ''}${deleting && deleting.description.length > 80 ? '…' : ''}"? Lịch sẽ không sinh thêm ticket nữa; các ticket bảo trì đã tạo vẫn được giữ.`}
            confirmLabel="Xoá lịch"
            danger
            loading={deleteSchedule.isPending}
            onConfirm={confirmDelete}
            onCancel={() => setDeleting(undefined)}
          />
        </>
      )}
    </div>
  )
}
