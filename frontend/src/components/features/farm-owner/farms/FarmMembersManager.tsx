import { useState, type FormEvent } from 'react'
import { PlusIcon } from '@phosphor-icons/react'
import { Badge, Button, Input, Modal, SelectMenu } from '@/components/ui'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import { CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { NO_VALUE } from '@/constants/display'
import { farmDict, type FarmKey } from '@/constants/farmStructure.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useFarm, useInviteFarmMember, useRemoveMember } from '@/hooks/shared/useFarms'
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
}

// Vai trò mời được (swagger POST /farms/:id/members: role FARM_OWNER | DOMAIN_EXPERT)
const INVITE_ROLES: FarmMemberRole[] = ['FARM_OWNER', 'DOMAIN_EXPERT']

interface MemberRow {
  userId: string
  name?: string
  email?: string
  role: MemberRoleKey
}

// Thành viên của 1 farm theo vai trò (AUTH-FR-005/010, EXPERT-FR-001): chủ chính, đồng sở hữu, chuyên gia; chỉ Primary Owner mời / gỡ
export default function FarmMembersManager({ farmId }: { farmId: string }) {
  const { t } = useTranslation(farmDict)
  const { data: farm, isLoading } = useFarm(farmId)
  const currentUserId = useAuthStore(state => state.user?._id)
  const removeMember = useRemoveMember(farmId)
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const [inviteRole, setInviteRole] = useState<FarmMemberRole | null>(null)
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null)

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
  const owners = rows.filter(row => row.role !== 'DOMAIN_EXPERT')
  const experts = rows.filter(row => row.role === 'DOMAIN_EXPERT')

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
      title={t(titleKey, { n: list.length })}
      description={t(descriptionKey)}
      action={isPrimaryOwner && (
        <Button variant="secondary" size="sm" className={cn('h-9 text-xs', CAPSULE_ACTION_CLASS)} onClick={() => setInviteRole(role)}>
          <PlusIcon size={14} weight="bold" />
          {t(role === 'DOMAIN_EXPERT' ? 'members.inviteExpert' : 'members.inviteOwner')}
        </Button>
      )}
    >
      {/* Bảng thành viên: tên + email · vai trò · thao tác */}
      <div className="overflow-hidden rounded-2xl border border-warmGray/15 bg-white">
        <div className="hidden grid-cols-[minmax(0,1fr)_10rem_6rem] gap-4 border-b border-warmGray/15 bg-warmGray/5 px-4 py-3 label-caption md:grid">
          <span>{t('members.colMember')}</span>
          <span>{t('members.colRole')}</span>
          <span className="text-center">{t('members.colActions')}</span>
        </div>
        {list.length === 0 && <p className="px-4 py-6 text-center text-sm text-warmGray">{t(emptyKey)}</p>}
        {list.map(row => (
          <div key={row.userId} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-t border-warmGray/10 px-4 py-3 first:border-t-0 md:grid-cols-[minmax(0,1fr)_10rem_6rem]">
            <div className="min-w-0">
              <p className={cn('truncate text-sm font-semibold', row.name ? 'text-charcoal' : 'text-warmGray')}>{row.name ?? NO_VALUE}</p>
              <p className="truncate text-xs text-warmGray">{row.email ?? NO_VALUE}</p>
            </div>
            <span>
              <Badge tone={row.role === 'DOMAIN_EXPERT' ? 'info' : 'neutral'}>{t(ROLE_LABEL[row.role])}</Badge>
            </span>
            <span className="flex justify-center">
              {isPrimaryOwner && row.role !== 'PRIMARY' ? (
                <Button variant="secondary" size="sm" onClick={() => setRemoveTarget(row)}>{t('members.remove')}</Button>
              ) : (
                <span className="text-warmGray">{NO_VALUE}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </FarmFrame>
  )

  return (
    <div className="flex flex-col gap-6">
      {renderSection('members.ownersTitle', 'members.ownersDesc', owners, 'FARM_OWNER', 'members.ownersEmpty')}
      {renderSection('members.expertsTitle', 'members.expertsDesc', experts, 'DOMAIN_EXPERT', 'members.expertsEmpty')}
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
          <p className="text-xs text-warmGray">{t(role === 'DOMAIN_EXPERT' ? 'members.expertHint' : 'members.ownerHint')}</p>
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
