// EXPERT-FR-014, 015 — Soạn và duyệt hồ sơ cấu hình (G-24)
import { useState } from 'react'
import { BookCopy, Plus, AlertTriangle } from 'lucide-react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { Button } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
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

const STATUS_FILTERS: { value: ConfigProfileStatus | 'ALL'; label: string }[] = [
  { value: 'ALL',      label: 'Tất cả' },
  { value: 'DRAFT',    label: 'Bản nháp' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'ARCHIVED', label: 'Lưu trữ' },
]

export default function DomainExpertProfilesPage() {
  const { selectedFarmId } = useZoneStore()
  const farmId = selectedFarmId ?? undefined

  const [statusFilter, setStatusFilter] = useState<ConfigProfileStatus | 'ALL'>('ALL')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ConfigProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: profiles, isLoading } = useProfiles(farmId, statusFilter === 'ALL' ? undefined : statusFilter)
  const createMut = useCreateProfile(farmId)
  const updateMut = useUpdateProfile(farmId)
  const approveMut = useApproveProfile(farmId)
  const archiveMut = useArchiveProfile(farmId)

  const pushToast = useToastStore(s => s.push)
  const getError = useApiErrorMessage()

  const isPending = createMut.isPending || updateMut.isPending || approveMut.isPending || archiveMut.isPending

  function openCreate() { setEditTarget(null); setDrawerOpen(true) }
  function openEdit(p: ConfigProfile) { setEditTarget(p); setDrawerOpen(true) }

  async function handleSubmit(input: ConfigProfileInput) {
    setError(null)
    try {
      if (editTarget) {
        await updateMut.mutateAsync({ id: editTarget._id, input })
        pushToast('Đã cập nhật hồ sơ.', 'success')
      } else {
        await createMut.mutateAsync(input)
        pushToast('Đã tạo hồ sơ bản nháp.', 'success')
      }
      setDrawerOpen(false)
    } catch (err) {
      setError(getError(err))
    }
  }

  async function handleApprove(id: string) {
    setError(null)
    try {
      await approveMut.mutateAsync(id)
      pushToast('Hồ sơ đã được duyệt.', 'success')
    } catch (err) {
      setError(getError(err))
    }
  }

  async function handleArchive(id: string) {
    setError(null)
    try {
      await archiveMut.mutateAsync(id)
      pushToast('Đã lưu trữ hồ sơ.', 'success')
    } catch (err) {
      setError(getError(err))
    }
  }

  if (!farmId) {
    return (
      <EmptyState
        icon={<BookCopy className="w-10 h-10" />}
        title="Chọn trang trại ở thanh trên để xem hồ sơ cấu hình"
      />
    )
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-charcoal">Hồ sơ cấu hình</h1>
          <p className="mt-0.5 text-sm text-warmGray">
            EXPERT-FR-014, 015 — Soạn hồ sơ bản nháp rồi duyệt; Farm Owner áp hồ sơ cho các nhà
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus className="w-3.5 h-3.5" /> Tạo hồ sơ
        </Button>
      </div>

      {/* Bộ lọc trạng thái */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              statusFilter === f.value
                ? 'bg-charcoal text-white border-charcoal'
                : 'bg-white text-warmGray border-warmGray/20 hover:border-warmGray/40'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-2xl bg-alertRed/5 border border-alertRed/20 text-sm text-alertRed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton count={3} className="h-16 w-full rounded-2xl" />
      ) : !profiles || profiles.length === 0 ? (
        <EmptyState
          icon={<BookCopy className="w-9 h-9" />}
          title={statusFilter === 'ALL' ? 'Chưa có hồ sơ nào. Tạo hồ sơ đầu tiên.' : `Không có hồ sơ ở trạng thái "${STATUS_FILTERS.find(f => f.value === statusFilter)?.label}".`}
        />
      ) : (
        <div className="space-y-3">
          {profiles.map(p => (
            <ProfileCard
              key={p._id}
              profile={p}
              onEdit={() => openEdit(p)}
              onApprove={() => handleApprove(p._id)}
              onArchive={() => handleArchive(p._id)}
              disabled={isPending}
            />
          ))}
        </div>
      )}

      <ProfileFormDrawer
        open={drawerOpen}
        initial={editTarget}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmit}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </div>
  )
}
