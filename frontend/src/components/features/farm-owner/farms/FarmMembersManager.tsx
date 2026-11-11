import { useState, type FormEvent, type ReactNode } from 'react'
import { PlusIcon } from '@phosphor-icons/react'
import { Badge, Button, FilterChip, Input, Modal, SearchInput, SelectMenu, Toggle } from '@/components/ui'
import ConfirmModal from '@/components/ui/ConfirmModal'
import type { DataTableColumn } from '@/components/ui/DataTable'
import FixedRowsTable from '@/components/ui/FixedRowsTable'
import TableEmptyState from '@/components/common/TableEmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import HouseRosterSection from '@/components/features/farm-owner/farms/HouseRosterSection'
import { CAPSULE_ACTION_CLASS, MEMBER_PAGE_SIZE, MEMBER_ROW_HEIGHT } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { NO_VALUE } from '@/constants/display'
import { farmDict, type FarmKey } from '@/constants/farmStructure.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import { usePermission } from '@/hooks/common/usePermission'
import { useFarm, useHouseRoster, useHouses, useInviteFarmMember, useRemoveMember, useSetHouseTechnician } from '@/hooks/shared/useFarms'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import type { FarmMemberRole } from '@/types'

// Vai trò hiển thị trong bảng thành viên; thêm role mới chỉ cần thêm dòng ở đây và trong INVITE_ROLES
type MemberRoleKey = 'PRIMARY' | FarmMemberRole

const ROLE_LABEL: Record<MemberRoleKey, FarmKey> = {
  PRIMARY: 'members.role.PRIMARY',
  FARM_OWNER: 'members.role.FARM_OWNER',
  DOMAIN_EXPERT: 'members.role.DOMAIN_EXPERT',
  FARM_TECHNICIAN: 'members.role.FARM_TECHNICIAN',
}

// Vai trò mời được (G-20: Farm Owner mời kỹ thuật viên vào farm, rồi giao nhà ở mục Kỹ thuật viên)
const INVITE_ROLES: FarmMemberRole[] = ['FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN']
const INVITE_HINT: Record<FarmMemberRole, FarmKey> = {
  FARM_OWNER: 'members.ownerHint',
  DOMAIN_EXPERT: 'members.expertHint',
  FARM_TECHNICIAN: 'members.technicianHint',
}

// Nhóm đang xem: farm đông người thì mỗi lần chỉ hiện 1 nhóm, đổi bằng chip thay vì cuộn qua cả 4 khung
type MemberGroup = 'owners' | 'experts' | 'technicians' | 'roster'

interface MemberRow {
  userId: string
  name?: string
  email?: string
  role: MemberRoleKey
}

// Khớp ô tìm kiếm theo tên hoặc email; query đã viết thường, rỗng thì khớp mọi dòng
const matchesQuery = (row: MemberRow, query: string): boolean =>
  !query || `${row.name ?? ''} ${row.email ?? ''}`.toLowerCase().includes(query)

// Thành viên của 1 farm theo vai trò (AUTH-FR-005/010, EXPERT-FR-001): chủ chính, đồng sở hữu, chuyên gia, kỹ thuật viên;
// chỉ Primary Owner mời / gỡ. Mở từ trang 1 nhà (houseId) thì mục Kỹ thuật viên có cột giao nhà này và thợ chính (AUTH-FR-013)
export default function FarmMembersManager({ farmId, houseId }: { farmId: string; houseId?: string }) {
  const { t } = useTranslation(farmDict)
  const { data: farm, isLoading } = useFarm(farmId)
  const currentUserId = useAuthStore(state => state.user?._id)
  const removeMember = useRemoveMember(farmId)
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const [inviteRole, setInviteRole] = useState<FarmMemberRole | null>(null)
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null)
  const [group, setGroup] = useState<MemberGroup>('owners')
  const { data: roster = [] } = useHouseRoster(houseId)
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()

  if (isLoading) return <LoadingSkeleton count={2} className="h-16 w-full" />
  if (!farm) return null

  // Chỉ Primary Owner (đúng owner_id) thêm/gỡ thành viên — route chỉ cho FARM_OWNER (AUTH-FR-005)
  const isPrimaryOwner = farm.owner_id === currentUserId
  const rows: MemberRow[] = [
    { userId: farm.owner_id, name: farm.owner?.full_name, email: farm.owner?.email, role: 'PRIMARY' },
    ...farm.members
      .filter(member => !member.is_primary && member.user_id !== farm.owner_id)
      .map(member => ({ userId: member.user_id, name: member.full_name, email: member.email, role: member.role ?? 'FARM_OWNER' })),
  ]
  const owners = rows.filter(row => row.role === 'PRIMARY' || row.role === 'FARM_OWNER')
  const experts = rows.filter(row => row.role === 'DOMAIN_EXPERT')
  const technicians = rows.filter(row => row.role === 'FARM_TECHNICIAN')

  function handleRemove(): void {
    if (!removeTarget) return
    removeMember.mutate(removeTarget.userId, {
      onSuccess: () => {
        push(t('members.removed'))
        setRemoveTarget(null)
      },
      onError: reason => push(apiErrorMessage(reason, t('members.removeFailed')), 'error'),
    })
  }

  const renderSection = (titleKey: FarmKey, descriptionKey: FarmKey, list: MemberRow[], role: FarmMemberRole, emptyKey: FarmKey) => (
    <FarmFrame
      top={groupChips}
      title={t(titleKey, { n: list.length })}
      description={t(descriptionKey)}
      action={(
        <div className="flex flex-wrap items-center gap-2">
          {searchBox}
          {isPrimaryOwner && (
            <Button variant="secondary" className={CAPSULE_ACTION_CLASS} onClick={() => setInviteRole(role)}>
              <PlusIcon size={16} weight="bold" />
              {t('members.invite')}
            </Button>
          )}
        </div>
      )}
    >
      {/* Bảng thành viên: tên + email · vai trò · thao tác */}
      <FixedRowsTable
        columns={[
          memberColumn(t('members.colMember')),
          {
            key: 'role', header: t('members.colRole'), className: 'w-40',
            render: row => <Badge tone={row.role === 'DOMAIN_EXPERT' ? 'info' : 'neutral'}>{t(ROLE_LABEL[row.role])}</Badge>,
          },
          {
            key: 'actions', header: t('members.colActions'), align: 'center', className: 'w-28',
            render: row => (isPrimaryOwner && row.role !== 'PRIMARY'
              ? <Button variant="secondary" size="sm" onClick={() => setRemoveTarget(row)}>{t('members.remove')}</Button>
              : <span className="text-warmGray">{NO_VALUE}</span>),
          },
        ]}
        rows={list.filter(row => matchesQuery(row, query))}
        getRowKey={row => row.userId}
        rowHeight={MEMBER_ROW_HEIGHT}
        pageSize={MEMBER_PAGE_SIZE}
        emptyNotice={t(query ? 'members.noMatch' : emptyKey)}
        emptyContent={<TableEmptyState title={t(query ? 'members.noMatch' : emptyKey)} />}
      />
    </FarmFrame>
  )

  // Chip mang đúng tiêu đề và số đếm của khung; lịch trực chỉ có ở trang 1 nhà
  const groups: Array<{ key: MemberGroup; label: string }> = [
    { key: 'owners', label: t('members.ownersTitle', { n: owners.length }) },
    { key: 'experts', label: t('members.expertsTitle', { n: experts.length }) },
    { key: 'technicians', label: t('members.techniciansTitle', { n: technicians.length }) },
    ...(houseId ? [{ key: 'roster' as const, label: t('roster.title', { n: roster.length }) }] : []),
  ]

  // Chip chọn nhóm nằm ngay trong thẻ của bảng (khe top của FarmFrame), không còn là 1 hàng rời
  const groupChips = (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('members.groups')}>
      {groups.map(item => (
        <FilterChip key={item.key} active={group === item.key} label={item.label} onClick={() => setGroup(item.key)} />
      ))}
    </div>
  )

  // Ô tìm theo tên / email, cùng hàng với nút tạo mới như các trang khác; từ khoá giữ nguyên khi đổi nhóm
  const searchBox = (
    <div className="w-full sm:w-64">
      <SearchInput placeholder={t('members.search')} value={search} onChange={setSearch} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {group === 'owners' && renderSection('members.ownersTitle', 'members.ownersDesc', owners, 'FARM_OWNER', 'members.ownersEmpty')}
      {group === 'experts' && renderSection('members.expertsTitle', 'members.expertsDesc', experts, 'DOMAIN_EXPERT', 'members.expertsEmpty')}
      {group === 'technicians' && (
        <TechnicianSection
          top={groupChips}
          searchBox={searchBox}
          farmId={farmId}
          houseId={houseId}
          technicians={technicians}
          isPrimaryOwner={isPrimaryOwner}
          onInvite={() => setInviteRole('FARM_TECHNICIAN')}
          onRemove={setRemoveTarget}
          query={query}
        />
      )}
      {group === 'roster' && houseId && (
        <HouseRosterSection top={groupChips} searchBox={searchBox} query={query} farmId={farmId} houseId={houseId} technicians={technicians} />
      )}
      {!isPrimaryOwner && <p className="text-xs text-warmGray">{t('members.primaryOnly')}</p>}

      {inviteRole && <InviteModal farmId={farmId} defaultRole={inviteRole} onClose={() => setInviteRole(null)} />}
      <ConfirmModal
        open={removeTarget !== null}
        title={t('members.removeTitle', { name: removeTarget?.name ?? removeTarget?.email ?? NO_VALUE })}
        description={t('members.removeDesc')}
        confirmLabel={t('members.remove')}
        danger
        loading={removeMember.isPending}
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  )
}

// Cột tên + email, dùng chung cho mọi bảng thành viên
function memberColumn(header: string): DataTableColumn<MemberRow> {
  return {
    key: 'member', header,
    render: row => (
      <div className="min-w-0">
        <p className={cn('truncate text-sm font-semibold', row.name ? 'text-charcoal' : 'text-warmGray')}>{row.name ?? NO_VALUE}</p>
        <p className="truncate text-xs text-warmGray">{row.email ?? NO_VALUE}</p>
      </div>
    ),
  }
}

// Popup mời thành viên: email + vai trò (chọn sẵn theo mục đang bấm, đổi được); lời mời hiệu lực 7 ngày
function InviteModal({ farmId, defaultRole, onClose }: { farmId: string; defaultRole: FarmMemberRole; onClose: () => void }) {
  const { t } = useTranslation(farmDict)
  const inviteMember = useInviteFarmMember(farmId)
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<FarmMemberRole>(defaultRole)

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    inviteMember.mutate({ email: email.trim(), role }, {
      onSuccess: () => {
        push(t('members.invited'))
        onClose()
      },
      onError: reason => push(apiErrorMessage(reason, t('members.inviteFailed')), 'error'),
    })
  }

  return (
    <Modal open onClose={onClose} title={t('members.inviteTitle')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label={t('members.email')} type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder={t('members.emailPlaceholder')} />
        <div className="flex flex-col gap-1.5">
          <span className="label-caption">{t('members.colRole')}</span>
          <SelectMenu
            field
            ariaLabel={t('members.colRole')}
            value={role}
            onChange={setRole}
            options={INVITE_ROLES.map(item => ({ value: item, label: t(ROLE_LABEL[item]) }))}
          />
          <p className="text-xs text-warmGray">{t(INVITE_HINT[role])}</p>
        </div>
        <p className="text-xs text-warmGray">{t('members.inviteHint')}</p>
        <div className="flex justify-end gap-2 border-t border-warmGray/10 pt-4">
          <Button type="button" variant="secondary" className="min-w-[8rem]" onClick={onClose}>{t('members.cancel')}</Button>
          <Button type="submit" className="min-w-[8rem]" loading={inviteMember.isPending} disabled={!email.trim()}>{t('members.send')}</Button>
        </div>
      </form>
    </Modal>
  )
}

interface TechnicianSectionProps {
  // Chip chọn nhóm, hiện trên tiêu đề trong cùng thẻ
  top: ReactNode
  farmId: string
  // Trang 1 nhà: có cột giao nhà này + thợ chính; không có thì chỉ là danh sách thành viên
  houseId?: string
  technicians: MemberRow[]
  isPrimaryOwner: boolean
  onInvite: () => void
  onRemove: (row: MemberRow) => void
  // Ô tìm kiếm (cùng hàng nút mời) và từ khoá đã viết thường
  searchBox: ReactNode
  query: string
}

// AUTH-FR-013 — kỹ thuật viên của farm; bật "Giao nhà này" là lưu ngay (PUT/DELETE …/technicians/:userId), mỗi nhà tối đa 1 thợ chính.
// Farm Owner nào cũng giao nhà được (backend chặn role khác); mời / gỡ khỏi farm vẫn chỉ Primary Owner
function TechnicianSection({ top, searchBox, farmId, houseId, technicians, isPrimaryOwner, onInvite, onRemove, query }: TechnicianSectionProps) {
  const { t } = useTranslation(farmDict)
  const isFarmOwner = usePermission('FARM_OWNER')
  const { data: houses } = useHouses(houseId ? farmId : undefined)
  const setTechnician = useSetHouseTechnician(farmId, houseId ?? '')
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const assignment = new Map((houses?.find(house => house._id === houseId)?.technicians ?? []).map(item => [item.user_id, item.primary]))
  const canAssign = Boolean(houseId) && isFarmOwner

  const labelOf = (row: MemberRow) => row.name ?? row.email ?? NO_VALUE
  const isSaving = (row: MemberRow) => setTechnician.isPending && setTechnician.variables?.userId === row.userId

  function save(row: MemberRow, assigned: boolean, primary: boolean, doneKey: FarmKey): void {
    const name = labelOf(row)
    setTechnician.mutate({ userId: row.userId, assigned, primary }, {
      onSuccess: () => push(t(doneKey, { name })),
      onError: reason => push(apiErrorMessage(reason, t('members.assignFailed')), 'error'),
    })
  }

  // Cột: thành viên · (giao nhà này · thợ chính, chỉ ở trang 1 nhà) · thao tác
  const houseColumns: DataTableColumn<MemberRow>[] = [
    {
      key: 'assigned', header: t('members.colAssigned'), align: 'center', className: 'w-32',
      render: row => (
        <Toggle
          checked={assignment.has(row.userId)}
          disabled={!canAssign || isSaving(row)}
          aria-label={t('members.assignLabel', { name: labelOf(row) })}
          onChange={checked => save(row, checked, false, checked ? 'members.assigned' : 'members.unassigned')}
        />
      ),
    },
    {
      key: 'primary', header: t('members.colPrimary'), align: 'center', className: 'w-28',
      render: row => {
        const isAssigned = assignment.has(row.userId)
        const isPrimary = assignment.get(row.userId) === true
        // Chọn thợ chính chỉ khi đã giao nhà; bấm lại thợ chính đang chọn thì nhà không còn thợ chính
        return (
          <button
            type="button"
            role="radio"
            aria-checked={isPrimary}
            aria-label={t('members.primaryLabel', { name: labelOf(row) })}
            title={isAssigned ? undefined : t('members.primaryNeedAssign')}
            disabled={!canAssign || !isAssigned || isSaving(row)}
            onClick={() => save(row, true, !isPrimary, isPrimary ? 'members.primaryCleared' : 'members.primarySet')}
            className={cn(
              'mx-auto flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              isPrimary ? 'border-charcoal' : 'border-warmGray/40 hover:border-charcoal/60',
            )}
          >
            {isPrimary && <span className="h-2.5 w-2.5 rounded-full bg-charcoal" />}
          </button>
        )
      },
    },
  ]
  const columns: DataTableColumn<MemberRow>[] = [
    memberColumn(t('members.colMember')),
    ...(houseId ? houseColumns : []),
    {
      key: 'actions', header: t('members.colActions'), align: 'center', className: 'w-28',
      render: row => (isPrimaryOwner
        ? <Button variant="secondary" size="sm" onClick={() => onRemove(row)}>{t('members.remove')}</Button>
        : <span className="text-warmGray">{NO_VALUE}</span>),
    },
  ]

  return (
    <FarmFrame
      top={top}
      title={t('members.techniciansTitle', { n: technicians.length })}
      description={t('members.techniciansDesc')}
      action={(
        <div className="flex flex-wrap items-center gap-2">
          {searchBox}
          {isPrimaryOwner && (
            <Button variant="secondary" className={CAPSULE_ACTION_CLASS} onClick={onInvite}>
              <PlusIcon size={16} weight="bold" />
              {t('members.invite')}
            </Button>
          )}
        </div>
      )}
    >
      <FixedRowsTable
        columns={columns}
        rows={technicians.filter(row => matchesQuery(row, query))}
        getRowKey={row => row.userId}
        rowHeight={MEMBER_ROW_HEIGHT}
        pageSize={MEMBER_PAGE_SIZE}
        emptyNotice={t(query ? 'members.noMatch' : 'members.techniciansEmpty')}
        emptyContent={<TableEmptyState title={t(query ? 'members.noMatch' : 'members.techniciansEmpty')} />}
      />
      {houseId && !isFarmOwner && <p className="mt-2 text-xs text-warmGray">{t('members.assignOwnerOnly')}</p>}
    </FarmFrame>
  )
}
