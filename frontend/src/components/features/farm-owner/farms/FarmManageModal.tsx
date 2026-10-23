import { useState } from 'react'
import { Badge, Button, Modal } from '@/components/ui'
import ConfirmModal from '@/components/ui/ConfirmModal'
import FarmFormModal from '@/components/features/farm-owner/farms/FarmFormModal'
import { NO_VALUE } from '@/constants/display'
import { farmDict } from '@/constants/farmStructure.i18n'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { usePermission } from '@/hooks/common/usePermission'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useDeleteFarm, useRegions } from '@/hooks/shared/useFarms'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import type { Farm } from '@/types'

interface FarmManageModalProps {
  farms: Farm[]
  // Số nhà và số thiết bị đang lắp của từng farm — farm còn thiết bị thì chặn xoá
  statsByFarm: Map<string, { houses: number; devices: number }>
  onClose: () => void
}

// Danh sách trang trại để sửa / xoá (FARM-FR-001): sửa tên, địa chỉ (khu vực chỉ Primary Owner); xoá mềm chỉ Primary Owner, chặn khi còn thiết bị
export default function FarmManageModal({ farms, statsByFarm, onClose }: FarmManageModalProps) {
  const { t, num } = useTranslation(farmDict)
  const currentUserId = useAuthStore(state => state.user?._id)
  const isAdmin = usePermission('ADMIN')
  const { data: regions } = useRegions()
  const deleteFarm = useDeleteFarm()
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()
  const [editFarm, setEditFarm] = useState<Farm | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Farm | null>(null)
  const regionNameByCode = new Map((regions ?? []).map(region => [region.code, region.name]))
  const isPrimaryOf = (farm: Farm) => isAdmin || farm.owner_id === currentUserId

  function handleDelete(): void {
    if (!deleteTarget) return
    deleteFarm.mutate(deleteTarget._id, {
      onSuccess: () => {
        push(t('manage.deleted', { name: deleteTarget.name }))
        setDeleteTarget(null)
      },
      onError: reason => {
        push(apiErrorMessage(reason, t('manage.deleteFailed')), 'error')
        setDeleteTarget(null)
      },
    })
  }

  return (
    <>
      <Modal open={!editFarm && !deleteTarget} onClose={onClose} title={t('manage.title')} className="max-w-2xl">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-warmGray">{t('manage.hint')}</p>
          <ul className="flex flex-col divide-y divide-warmGray/10 rounded-2xl border border-warmGray/15">
            {farms.map(farm => {
              const stats = statsByFarm.get(farm._id) ?? { houses: 0, devices: 0 }
              const isPrimary = isPrimaryOf(farm)
              const hasDevices = stats.devices > 0
              return (
                <li key={farm._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-semibold text-charcoal">
                      {farm.name}
                      {isPrimary && <Badge tone="neutral">{t('manage.primary')}</Badge>}
                    </p>
                    <p className="truncate text-xs text-warmGray">
                      {(farm.region && regionNameByCode.get(farm.region)) ?? NO_VALUE} · {farm.address || NO_VALUE}
                    </p>
                    <p className="text-xs text-warmGray">{t('manage.stats', { houses: num(stats.houses), devices: num(stats.devices) })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditFarm(farm)}>{t('manage.edit')}</Button>
                    {isPrimary && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={hasDevices}
                        title={hasDevices ? t('manage.deleteBlocked', { n: num(stats.devices) }) : undefined}
                        onClick={() => setDeleteTarget(farm)}
                      >
                        {t('manage.delete')}
                      </Button>
                    )}
                  </div>
                  {isPrimary && hasDevices && (
                    <p className="w-full text-xs text-orange-700">{t('manage.deleteBlocked', { n: num(stats.devices) })}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </Modal>

      {editFarm && <FarmFormModal farm={editFarm} canChangeRegion={isPrimaryOf(editFarm)} onClose={() => setEditFarm(null)} />}
      <ConfirmModal
        open={deleteTarget !== null}
        title={t('manage.deleteTitle', { name: deleteTarget?.name ?? NO_VALUE })}
        description={t('manage.deleteDesc')}
        confirmLabel={t('manage.delete')}
        danger
        loading={deleteFarm.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
