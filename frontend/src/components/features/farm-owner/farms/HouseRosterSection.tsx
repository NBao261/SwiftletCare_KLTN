import { useState, type FormEvent, type ReactNode } from 'react'
import { PlusIcon } from '@phosphor-icons/react'
import { Badge, Button, FilterChip, Input, Modal, SelectMenu } from '@/components/ui'
import ActionsMenu from '@/components/ui/ActionsMenu'
import type { DataTableColumn } from '@/components/ui/DataTable'
import FixedRowsTable from '@/components/ui/FixedRowsTable'
import TableEmptyState from '@/components/common/TableEmptyState'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import { CAPSULE_ACTION_CLASS, MEMBER_PAGE_SIZE, MEMBER_ROW_HEIGHT } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { NO_VALUE } from '@/constants/display'
import { farmDict, type FarmKey } from '@/constants/farmStructure.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { usePermission } from '@/hooks/common/usePermission'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useHouseRoster, useHouses, useSetHouseRoster } from '@/hooks/shared/useFarms'
import { useToastStore } from '@/stores/toastStore'
import { isOvernightShift, validateRosterShift, WEEK_ORDER, type RosterError } from '@/validations/farm-owner/roster.validation'
import type { RosterShift } from '@/types'

const DAY_LABEL: FarmKey[] = ['roster.day.0', 'roster.day.1', 'roster.day.2', 'roster.day.3', 'roster.day.4', 'roster.day.5', 'roster.day.6']
const ROLE_LABEL: Record<RosterShift['role'], FarmKey> = { PRIMARY: 'roster.role.PRIMARY', BACKUP: 'roster.role.BACKUP' }
const ROLES: RosterShift['role'][] = ['PRIMARY', 'BACKUP']

// Dòng bảng: ca kèm vị trí trong lịch (sửa / xoá theo vị trí)
interface ShiftRow { shift: RosterShift; index: number }

interface HouseRosterSectionProps {
  // Chip chọn nhóm, hiện trên tiêu đề trong cùng thẻ
  top?: ReactNode
  // Ô tìm kiếm (cùng hàng nút Thêm ca) và từ khoá đã viết thường: chỉ hiện ca của thợ có tên khớp
  searchBox?: ReactNode
  query: string
  farmId: string
  houseId: string
  // Kỹ thuật viên của farm (tên, email) để hiện tên trong ca
  technicians: Array<{ userId: string; name?: string; email?: string }>
}

// Trạng thái popup: thêm ca mới (index null) hoặc sửa ca thứ index
type Editing = { index: number | null } | null

// AUTH-FR-014 — lịch trực theo tuần của 1 nhà: Farm Owner thêm / sửa / xoá ca (mỗi lần gửi lại cả lịch), Domain Expert chỉ xem
export default function HouseRosterSection({ top, searchBox, query, farmId, houseId, technicians }: HouseRosterSectionProps) {
  const { t } = useTranslation(farmDict)
  const isFarmOwner = usePermission('FARM_OWNER')
  const { data: houses } = useHouses(farmId)
  const { data: roster = [], isLoading, isError, refetch } = useHouseRoster(houseId)
  const setRoster = useSetHouseRoster(houseId)
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const [editing, setEditing] = useState<Editing>(null)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)

  const house = houses?.find(item => item._id === houseId)
  const nameById = new Map(technicians.map(row => [row.userId, row.name ?? row.email ?? NO_VALUE]))
  // Chỉ thợ đang được giao nhà này mới xếp ca được (backend trả 409 nếu không)
  const assigned = (house?.technicians ?? [])
    .filter(item => nameById.has(item.user_id))
    .map(item => ({ value: item.user_id, label: nameById.get(item.user_id) ?? NO_VALUE }))

  const daysText = (weekdays: number[]) => WEEK_ORDER.filter(day => weekdays.includes(day)).map(day => t(DAY_LABEL[day])).join(', ')
  const timeText = (shift: RosterShift) => `${shift.start}–${shift.end}${isOvernightShift(shift) ? ` (${t('roster.overnight')})` : ''}`

  function save(shifts: RosterShift[], onDone: () => void): void {
    setRoster.mutate(shifts, {
      onSuccess: () => {
        push(t('roster.saved'))
        onDone()
      },
      onError: reason => push(apiErrorMessage(reason, t('roster.saveFailed')), 'error'),
    })
  }

  const deleting = deleteIndex === null ? null : roster[deleteIndex]
  // Dòng giữ vị trí gốc trong lịch nên lọc theo tên không làm lệch sửa / xoá
  const rows = roster
    .map((shift, index) => ({ shift, index }))
    .filter(row => !query || (nameById.get(row.shift.technician_id) ?? '').toLowerCase().includes(query))
  const emptyText = roster.length > 0 ? t('members.noMatch') : assigned.length === 0 && isFarmOwner ? t('roster.needTechnician') : t('roster.empty')

  // Cột: kỹ thuật viên · vai · ngày · giờ · thao tác
  const columns: DataTableColumn<ShiftRow>[] = [
    {
      key: 'technician', header: t('roster.colTechnician'),
      render: ({ shift }) => <p className="truncate text-sm font-semibold text-charcoal">{nameById.get(shift.technician_id) ?? NO_VALUE}</p>,
    },
    {
      key: 'role', header: t('roster.colRole'), className: 'w-36',
      render: ({ shift }) => <Badge tone={shift.role === 'PRIMARY' ? 'info' : 'neutral'}>{t(ROLE_LABEL[shift.role])}</Badge>,
    },
    { key: 'days', header: t('roster.colDays'), render: ({ shift }) => <span className="text-sm text-graphite">{daysText(shift.weekdays)}</span> },
    {
      key: 'time', header: t('roster.colTime'), className: 'w-48',
      render: ({ shift }) => <span className="font-mono text-sm tabular-nums text-graphite">{timeText(shift)}</span>,
    },
    {
      key: 'actions', header: '', align: 'center', className: 'w-16',
      render: ({ index }) => (isFarmOwner ? (
        <ActionsMenu
          items={[
            { label: t('roster.edit'), onClick: () => setEditing({ index }) },
            { label: t('roster.delete'), onClick: () => setDeleteIndex(index), danger: true },
          ]}
        />
      ) : null),
    },
  ]

  return (
    <FarmFrame
      top={top}
      title={t('roster.title', { n: roster.length })}
      description={t('roster.desc')}
      action={(
        <div className="flex flex-wrap items-center gap-2">
          {searchBox}
          {isFarmOwner && (
            <Button
              variant="secondary"
              className={CAPSULE_ACTION_CLASS}
              disabled={assigned.length === 0}
              title={assigned.length === 0 ? t('roster.needTechnician') : undefined}
              onClick={() => setEditing({ index: null })}
            >
              <PlusIcon size={16} weight="bold" />
              {t('roster.add')}
            </Button>
          )}
        </div>
      )}
    >
      {isLoading ? (
        <LoadingSkeleton count={2} className="h-12 w-full" />
      ) : isError ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-warmGray/15 bg-white px-4 py-4 text-sm text-warmGray">
          {t('roster.loadFailed')}
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('state.retry')}</Button>
        </div>
      ) : (
        <FixedRowsTable
          columns={columns}
          rows={rows}
          getRowKey={row => `${row.shift.technician_id}-${row.shift.role}-${row.index}`}
          rowHeight={MEMBER_ROW_HEIGHT}
          pageSize={MEMBER_PAGE_SIZE}
          emptyNotice={emptyText}
          emptyContent={<TableEmptyState title={emptyText} />}
        />
      )}
      {!isFarmOwner && <p className="mt-2 text-xs text-warmGray">{t('roster.ownerOnly')}</p>}

      {editing && (
        <ShiftModal
          title={t(editing.index === null ? 'roster.addTitle' : 'roster.editTitle', { house: house?.name ?? NO_VALUE })}
          initial={editing.index === null ? null : roster[editing.index]}
          options={assigned}
          others={roster.filter((_, index) => index !== editing.index)}
          saving={setRoster.isPending}
          onClose={() => setEditing(null)}
          onSave={shift => save(
            editing.index === null ? [...roster, shift] : roster.map((item, index) => (index === editing.index ? shift : item)),
            () => setEditing(null),
          )}
        />
      )}
      <ConfirmModal
        open={deleting !== null}
        title={t('roster.deleteTitle', { name: deleting ? nameById.get(deleting.technician_id) ?? NO_VALUE : NO_VALUE })}
        description={deleting ? t('roster.deleteDesc', { days: daysText(deleting.weekdays), time: timeText(deleting) }) : ''}
        confirmLabel={t('roster.delete')}
        danger
        loading={setRoster.isPending}
        onConfirm={() => save(roster.filter((_, index) => index !== deleteIndex), () => setDeleteIndex(null))}
        onCancel={() => setDeleteIndex(null)}
      />
    </FarmFrame>
  )
}

interface ShiftModalProps {
  title: string
  initial: RosterShift | null
  options: Array<{ value: string; label: string }>
  // Các ca còn lại của nhà, để kiểm chồng giờ cùng vai
  others: RosterShift[]
  saving: boolean
  onClose: () => void
  onSave: (shift: RosterShift) => void
}

// Popup 1 ca: thợ + vai, các ngày trong tuần, giờ bắt đầu / kết thúc (ô giờ của trình duyệt)
function ShiftModal({ title, initial, options, others, saving, onClose, onSave }: ShiftModalProps) {
  const { t } = useTranslation(farmDict)
  const [technicianId, setTechnicianId] = useState(initial?.technician_id ?? options[0]?.value ?? '')
  const [role, setRole] = useState<RosterShift['role']>(initial?.role ?? 'PRIMARY')
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? [])
  const [start, setStart] = useState(initial?.start ?? '')
  const [end, setEnd] = useState(initial?.end ?? '')
  const [error, setError] = useState<RosterError | null>(null)

  const toggleDay = (day: number) => setWeekdays(current => (current.includes(day) ? current.filter(item => item !== day) : [...current, day]))

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    const shift: RosterShift = { technician_id: technicianId, role, weekdays: [...weekdays].sort((a, b) => a - b), start, end }
    const problem = validateRosterShift(shift, others)
    setError(problem)
    if (!problem) onSave(shift)
  }

  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <hr className="border-gray-200" />
        <p className="text-sm text-warmGray">{t('roster.intro')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <div className="flex flex-col gap-1.5">
            <span className="label-caption">{t('roster.colTechnician')}</span>
            <SelectMenu field ariaLabel={t('roster.colTechnician')} value={technicianId} onChange={setTechnicianId} options={options} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="label-caption">{t('roster.colRole')}</span>
            <SelectMenu field ariaLabel={t('roster.colRole')} value={role} onChange={setRole} options={ROLES.map(item => ({ value: item, label: t(ROLE_LABEL[item]) }))} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="label-caption">{t('roster.colDays')}</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('roster.colDays')}>
            {WEEK_ORDER.map(day => (
              <FilterChip key={day} active={weekdays.includes(day)} label={t(DAY_LABEL[day])} onClick={() => toggleDay(day)} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('roster.start')} type="time" value={start} onChange={event => setStart(event.target.value)} />
          <Input label={t('roster.end')} type="time" value={end} onChange={event => setEnd(event.target.value)} />
        </div>
        {error && (
          <p className="text-xs text-alertRed">
            {error === 'roster.errOverlap' ? t(error, { role: t(ROLE_LABEL[role]).toLowerCase() }) : t(error)}
          </p>
        )}
        <div className="flex justify-end border-t border-gray-200 pt-4">
          <Button type="submit" className="min-w-[8rem]" loading={saving}>{t('roster.save')}</Button>
        </div>
      </form>
    </Modal>
  )
}
