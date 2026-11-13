// EXPERT-FR-014, 015 — Soạn và duyệt hồ sơ cấu hình (G-24)
import { useState } from 'react'
import { BookCopy, Plus, AlertTriangle } from 'lucide-react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
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
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <BookCopy className="w-10 h-10 text-neutral-300" />
        <p className="text-sm font-medium text-[#878380]">Chọn trang trại ở thanh trên để xem hồ sơ cấu hình</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#27231F]">Hồ sơ cấu hình</h1>
          <p className="mt-0.5 text-xs text-[#878380]">
            EXPERT-FR-014, 015 — Soạn hồ sơ bản nháp rồi duyệt; Farm Owner áp hồ sơ cho các nhà
          </p>
        </div>
        <button
          onClick={openCreate}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#27231F] text-white text-xs font-semibold hover:bg-[#3D3630] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Tạo hồ sơ
        </button>
      </div>

      {/* Bộ lọc trạng thái */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
              statusFilter === f.value
                ? 'bg-[#27231F] text-white border-[#27231F]'
                : 'bg-white text-[#878380] border-neutral-200 hover:border-neutral-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lỗi */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Danh sách */}
      {isLoading ? (
        <LoadingSkeleton count={3} className="h-16 w-full rounded-xl" />
      ) : !profiles || profiles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <BookCopy className="w-9 h-9 text-neutral-300" />
          <p className="text-sm text-[#878380]">
            {statusFilter === 'ALL' ? 'Chưa có hồ sơ nào. Tạo hồ sơ đầu tiên.' : `Không có hồ sơ ở trạng thái "${STATUS_FILTERS.find(f => f.value === statusFilter)?.label}".`}
          </p>
        </div>
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
