// Chuyên gia, Farm Owner và Kỹ thuật viên (nhà được giao) vẽ vòng đếm, trên web như trên mobile
import { useState, useEffect } from 'react'
import { Crosshair } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import LoadError from '@/components/ui/LoadError'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import SectionCard from '@/components/ui/SectionCard'
import SelectMenu, { type SelectMenuOption } from '@/components/ui/SelectMenu'
import { useZoneStore } from '@/stores/zoneStore'
import { useHouseCameras } from '@/hooks/domain-expert/useCountingRing'
import CountingRingEditor from '@/components/features/domain-expert/counting-ring/CountingRingEditor'
import CountingRingHistory from '@/components/features/domain-expert/counting-ring/CountingRingHistory'
import SimulatedBadge from '@/components/common/SimulatedBadge'
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights'
import { usePermission } from '@/hooks/common/usePermission'
import { t } from '@/i18n'

export default function DomainExpertCountingRingPage() {
  const { canEditParameters } = useExpertDecisionRights()
  // Kỹ thuật viên không sửa tham số nhưng vẽ vòng đếm camera của nhà được giao
  const isTechnician = usePermission('FARM_TECHNICIAN')
  const canDrawRing = canEditParameters || isTechnician
  const { selectedHouseId } = useZoneStore()
  const houseId = selectedHouseId || undefined
  const { data: cameras, isLoading, isError, error, refetch } = useHouseCameras(houseId)
  const [selectedCameraId, setSelectedCameraId] = useState('')

  useEffect(() => {
    setSelectedCameraId('')
  }, [selectedHouseId])

  if (!selectedHouseId) {
    return <EmptyState icon={<Crosshair className="w-8 h-8" />} title={t('Chọn nhà yến ở thanh trên để vẽ vòng đếm')} />
  }

  const list = cameras ?? []
  const activeCameraId = selectedCameraId || list[0]?._id || ''
  const camera = list.find(item => item._id === activeCameraId)
  const cameraOptions: SelectMenuOption<string>[] = list.map(item => ({ value: item._id, label: item.device_id }))

  return (
    <div className="flex w-full flex-col gap-6">
      <SectionCard
        description={t('Chim bay qua vòng quanh lỗ ra vào mới được đếm')}
        help={t('Vẽ tối đa 4 vòng khép kín quanh miệng lỗ ra vào trên khung hình trực tiếp. Mỗi vòng đếm cả chim vào lẫn chim ra, chỉ chim bay qua vòng mới được đếm.')}
        action={
          list.length > 1 ? (
            <SelectMenu
              value={activeCameraId}
              options={cameraOptions}
              onChange={setSelectedCameraId}
              ariaLabel={t('Chọn camera')}
              field
            />
          ) : undefined
        }
      >
        {isLoading && <LoadingSkeleton count={1} className="aspect-video w-full rounded-2xl" />}

        {isError && !isLoading && <LoadError title={t('Không tải được danh sách camera')} error={error} onRetry={() => void refetch()} />}

        {!isLoading && !isError && list.length === 0 && (
          <EmptyState icon={<Crosshair className="w-7 h-7" />} title={t('Nhà yến này chưa gắn camera nào.')} />
        )}

        {!isLoading && !isError && camera && (
          <div className="space-y-2">
            <SimulatedBadge simulated={camera.simulated} />
            {/* Farm Owner, Kỹ thuật viên vẽ được; farm có chuyên gia thì chuyên gia duyệt sau */}
            <fieldset disabled={!canDrawRing} className="contents">
              <CountingRingEditor key={camera._id} camera={camera} houseId={houseId} />
            </fieldset>
          </div>
        )}
      </SectionCard>

      {!isLoading && !isError && camera && (camera.counting_ring_history?.length ?? 0) > 0 && (
        <SectionCard title={t('Lịch sử vòng đếm')}>
          <CountingRingHistory camera={camera} />
        </SectionCard>
      )}
    </div>
  )
}
