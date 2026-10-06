// TechnicianMaintenancePage — TICKET-FR-013: lịch bảo trì định kỳ theo Farm.
// Đến hạn, job backend tự tạo ticket MAINTENANCE (sớm vài ngày) rồi dời hạn sang chu kỳ kế tiếp.
// Technician/Admin: tạo · sửa · tạm dừng · xoá. Farm Owner chỉ xem (BE requireRole).
// Cùng khuôn với các trang danh sách của Admin: DataTable + Badge + ActionsMenu + ConfirmModal.
import { useMemo, useState } from 'react'
import { Button, Badge, DataTable, EmptyState, SelectMenu, ConfirmModal, ActionsMenu, type DataTableColumn, type ActionsMenuItem } from '@/components/ui'
import { Plus } from 'lucide-react'
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

export default function TechnicianMaintenancePage() {
  // BE: GET cho FARM_OWNER/TECHNICIAN/ADMIN; POST/PUT/DELETE chỉ TECHNICIAN/ADMIN
  const canManage = usePermission('TECHNICIAN', 'ADMIN')
  const push = useToastStore(s => s.push)

  const [farmId, setFarmId] = useState(ALL_FARMS)
  const [page, setPage] = useState(1)
  const { data: farms } = useFarms()
  const { data: zones } = useAllZones()
  const { records: schedules, total, isLoading, isError } = useMaintenanceSchedules(farmId || undefined, page, PAGE_SIZE)
  const updateSchedule = useUpdateMaintenanceSchedule()
  const deleteSchedule = useDeleteMaintenanceSchedule()

  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<MaintenanceSchedule | undefined>()
  const [deleting, setDeleting] = useState<MaintenanceSchedule | undefined>()

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
      key: 'description', header: 'Nội dung', className: 'w-[32%]',
      render: s => <p className="line-clamp-2 font-medium text-charcoal" title={s.description}>{s.description}</p>,
    },
    {
      key: 'farm', header: 'Trang trại · Zone', className: 'w-[22%]',
      render: s => (
        <div className="min-w-0">
          <p className="truncate font-medium text-charcoal">{farmName.get(s.farm_id) ?? '—'}</p>
          <p className="truncate text-xs text-warmGray">{s.zone_id ? (zoneName.get(s.zone_id) ?? 'Zone') : 'Toàn trang trại'}</p>
        </div>
      ),
    },
    { key: 'interval', header: 'Chu kỳ', className: 'w-[10%]', render: s => <span className="tabular-nums">{s.interval_days} ngày</span> },
    { key: 'next', header: 'Lần kế tiếp', className: 'w-[16%]', render: s => <span className="tabular-nums">{formatDate(s.next_due_at)}</span> },
    {
      key: 'status', header: 'Trạng thái', className: 'w-[10%]',
      render: s => !s.is_active
        ? <Badge tone="neutral">Tạm dừng</Badge>
        : new Date(s.next_due_at).getTime() <= Date.now()
          ? <Badge tone="warning">Đến hạn</Badge>
          : <Badge tone="positive">Đang chạy</Badge>,
    },
    ...(canManage ? [{
      key: 'actions', header: 'Thao tác', align: 'right' as const, className: 'w-[10%]',
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caption">Bảo trì định kỳ</p>
          <h1 className="truncate text-2xl font-bold tracking-tight text-charcoal">Lịch bảo trì</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectMenu ariaLabel="Lọc theo trang trại" value={farmId} options={farmOptions} onChange={v => { setFarmId(v); setPage(1) }} />
          {canManage && <Button onClick={() => setShowCreate(true)}><Plus size={18} strokeWidth={2} /> Tạo lịch bảo trì</Button>}
        </div>
      </div>

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

      {!isLoading && !isError && !!schedules?.length && (
        <>
          <DataTable
            columns={columns}
            rows={schedules}
            getRowKey={s => s._id}
            emptyMessage="Chưa có lịch bảo trì nào"
          />
          <Pagination page={page} limit={PAGE_SIZE} total={total} onChange={setPage} variant="full" />
        </>
      )}

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
