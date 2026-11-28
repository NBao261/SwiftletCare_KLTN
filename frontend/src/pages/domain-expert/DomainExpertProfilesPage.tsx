// Soạn và duyệt hồ sơ cấu hình
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookCopy } from 'lucide-react'
import { PlusIcon } from '@phosphor-icons/react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { Button } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import ErrorNotice from '@/components/ui/ErrorNotice'
import LoadError from '@/components/ui/LoadError'
import SectionCard from '@/components/ui/SectionCard'
import StatusTabs from '@/components/common/StatusTabs'
import { useZoneStore } from '@/stores/zoneStore'
import { useToastStore } from '@/stores/toastStore'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import {
  useProfiles,
  useCreateProfile,
  useUpdateProfile,
  useApproveProfile,
  useArchiveProfile,
} from '@/hooks/domain-expert/useProfiles'
import ProfileCard from '@/components/features/domain-expert/profiles/ProfileCard'
import ProfileFormDrawer from '@/components/features/domain-expert/profiles/ProfileFormDrawer'
import type { ConfigProfile, ConfigProfileInput, ConfigProfileStatus } from '@/types/expert.types'
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights'
import { t } from '@/i18n'

const STATUS_FILTERS: { value: ConfigProfileStatus | 'ALL'; label: string }[] = [
  { value: 'ALL',      label: 'Tất cả' },
  { value: 'DRAFT',    label: 'Bản nháp' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'ARCHIVED', label: 'Lưu trữ' },
]

export default function DomainExpertProfilesPage() {
  // Farm Owner soạn bản nháp, chỉ chuyên gia duyệt
  const { isExpert, canEditParameters, ownerNeedsExpert, farmKnown } = useExpertDecisionRights()
  const { selectedFarmId } = useZoneStore()
  const farmId = selectedFarmId ?? undefined

  // Hàng đợi việc mở thẳng tab bản nháp bằng ?status=DRAFT
  const [searchParams] = useSearchParams()
  const initialStatus = STATUS_FILTERS.find(f => f.value === searchParams.get('status'))?.value ?? 'ALL'
  const [statusFilter, setStatusFilter] = useState<ConfigProfileStatus | 'ALL'>(initialStatus)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ConfigProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: profiles, isLoading, isError, error: loadError, refetch } = useProfiles(farmId, statusFilter === 'ALL' ? undefined : statusFilter)
  const createMut = useCreateProfile(farmId)
  const updateMut = useUpdateProfile(farmId)
  const approveMut = useApproveProfile(farmId)
  const archiveMut = useArchiveProfile(farmId)

  const pushToast = useToastStore(s => s.push)
  const getError = useApiErrorMessage()

  const isPending = createMut.isPending || updateMut.isPending || approveMut.isPending || archiveMut.isPending

  function openCreate() { setEditTarget(null); setError(null); setDrawerOpen(true) }
  function openEdit(p: ConfigProfile) { setEditTarget(p); setError(null); setDrawerOpen(true) }

  async function handleSubmit(input: ConfigProfileInput) {
    setError(null)
    try {
      if (editTarget) {
        await updateMut.mutateAsync({ id: editTarget._id, input })
        pushToast('Đã cập nhật hồ sơ.', 'success')
      } else {
        await createMut.mutateAsync(input)
        pushToast(ownerNeedsExpert ? t('Đã tạo hồ sơ bản nháp. Chuyên gia duyệt rồi bạn mới áp được.') : t('Đã tạo hồ sơ bản nháp.'), 'success')
      }
      setDrawerOpen(false)
    } catch (err) {
      setError(getError(err, t('Lưu hồ sơ thất bại')))
    }
  }

  async function handleApprove(id: string) {
    setError(null)
    try {
      await approveMut.mutateAsync(id)
      pushToast('Hồ sơ đã được duyệt.', 'success')
    } catch (err) {
      setError(getError(err, t('Duyệt hồ sơ thất bại')))
    }
  }

  async function handleArchive(id: string) {
    setError(null)
    try {
      await archiveMut.mutateAsync(id)
      pushToast('Đã lưu trữ hồ sơ.', 'success')
    } catch (err) {
      setError(getError(err, t('Lưu trữ hồ sơ thất bại')))
    }
  }

  if (!farmId) {
    return (
      <EmptyState
        icon={<BookCopy className="w-10 h-10" />}
        title={t('Chọn trang trại ở thanh trên để xem hồ sơ cấu hình')}
      />
    )
  }

  // Danh sách hồ sơ theo bộ lọc; rỗng chỉ 1 dòng như các tab cùng nhóm
  function renderProfiles() {
    if (isLoading) return <LoadingSkeleton count={3} className="h-16 w-full rounded-2xl" />
    if (isError) {
      return <LoadError title={t('Không tải được danh sách hồ sơ')} error={loadError} onRetry={() => void refetch()} />
    }
    if (!profiles || profiles.length === 0) {
      const filterLabel = STATUS_FILTERS.find(f => f.value === statusFilter)?.label ?? ''
      return (
        <p className="py-6 text-center text-sm text-warmGray">
          {statusFilter === 'ALL' ? t('Chưa có hồ sơ nào. Tạo hồ sơ đầu tiên.') : t('Không có hồ sơ ở trạng thái "{{status}}".', { status: t(filterLabel) })}
        </p>
      )
    }
    return (
      <div className="space-y-3">
        {profiles.map(p => (
          <ProfileCard
            key={p._id}
            profile={p}
            onEdit={() => openEdit(p)}
            onApprove={() => handleApprove(p._id)}
            onArchive={() => handleArchive(p._id)}
            disabled={isPending}
            canEditDraft={canEditParameters}
            canApprove={isExpert}
            farmHasExpert={isExpert || ownerNeedsExpert || !farmKnown}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Khung giống các tab cùng nhóm Tham số điều khiển: một card, tên trang đã ở header nên không có h1 riêng */}
      <SectionCard
        description={t('Bộ ngưỡng và hệ số mẫu để áp cho nhiều nhà')}
        help={t('Soạn hồ sơ bản nháp rồi duyệt; chủ nhà yến áp hồ sơ cho các nhà')}
        action={canEditParameters ? (
          <Button variant="primary" size="sm" onClick={openCreate}>
            <PlusIcon size={14} weight="bold" /> {t('Tạo hồ sơ')}
          </Button>
        ) : undefined}
      >
        <StatusTabs
          variant="underline"
          ariaLabel={t('Lọc hồ sơ theo trạng thái')}
          value={statusFilter}
          onChange={setStatusFilter}
          tabs={STATUS_FILTERS.map(f => ({ id: f.value, label: t(f.label) }))}
        />

        {error && <ErrorNotice>{error}</ErrorNotice>}

        {renderProfiles()}
      </SectionCard>

      <ProfileFormDrawer
        open={drawerOpen}
        initial={editTarget}
        onClose={() => { setDrawerOpen(false); setError(null) }}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
        error={error}
      />
    </div>
  )
}
