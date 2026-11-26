import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { PlusIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button, EmptyState } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import ConfirmModal from '@/components/ui/ConfirmModal'
import HouseTable from '@/components/features/farm-owner/farms/HouseTable'
import AddHouseModal from '@/components/features/farm-owner/farms/AddHouseModal'
import ApplyProfileModal from '@/components/features/farm-owner/farms/ApplyProfileModal'
import FarmFormModal from '@/components/features/farm-owner/farms/FarmFormModal'
import FarmBlock from '@/components/features/farm-owner/farms/FarmBlock'
import ScopeFilter from '@/components/common/ScopeFilter'
import HeaderActions from '@/components/layouts/HeaderActions'
import { farmHousePath, farmZonePath, useFarmsScopeRouting, useScopeFilter } from '@/hooks/shared/useScopeFilter'
import { isUpFromChildState } from '@/lib/navigationState'
import { useDeleteFarm, useFarms } from '@/hooks/shared/useFarms'
import { usePinnedHouses } from '@/hooks/farm-owner/usePinnedHouses'
import { useFarmStructure, useHouseStaff } from '@/hooks/farm-owner/useFarmStructure'
import { useScrollToTop } from '@/hooks/common/useScrollToTop'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { usePermission } from '@/hooks/common/usePermission'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { NO_VALUE } from '@/constants/display'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import type { Farm } from '@/types'
import type { HouseNode } from '@/components/features/farm-owner/farms/farmStructure'

// Trang trại theo khung lọc, mỗi farm một thẻ kèm bảng nhà yến
export default function FarmOwnerFarmsPage() {
  const { t } = useTranslation(farmDict)
  useScrollToTop()
  const navigate = useNavigate()
  const { data: farms } = useFarms()
  const { structure, isLoading, isError, canViewHarvest, refetch } = useFarmStructure()
  // Nhà đã có (kèm trang trại) để chặn tạo nhà trùng tên trong cùng trang trại
  const existingHouses = useMemo(() => structure.houses.map(node => node.house), [structure.houses])
  const staffByHouse = useHouseStaff(existingHouses)
  const { pinned, toggle: togglePin } = usePinnedHouses()
  // Khung lọc chung các trang Farm Owner, lưu khi chuyển trang; chọn nhà / Zone thì sang trang chi tiết đúng cấp
  const scope = useScopeFilter()
  const routedScope = useFarmsScopeRouting(scope)
  const navigationType = useNavigationType()
  const location = useLocation()
  // Đi lên từ trang chi tiết (Quay lại, breadcrumb, menu, đổi khung lọc gắn state) hoặc bấm Back của trình duyệt
  const isGoingUp = navigationType === 'POP' || isUpFromChildState(location.state)
  const hasRoutedRef = useRef(false)
  // Chạy 1 lần khi khung lọc tải xong: đang lọc 1 nhà / Zone thì mở thẳng trang đó; đi lên thì bỏ lọc nhà, Zone
  useEffect(() => {
    if (hasRoutedRef.current || scope.isLoading) return
    hasRoutedRef.current = true
    if (isGoingUp) {
      if (scope.houseId) scope.setHouseId('')
      return
    }
    if (scope.zone) navigate(farmZonePath(scope.zone.farmId, scope.zone.house_id, scope.zone._id), { replace: true })
    else if (scope.houseId && scope.farmId) navigate(farmHousePath(scope.farmId, scope.houseId), { replace: true })
  }, [scope, isGoingUp, navigate])
  const currentUserId = useAuthStore(state => state.user?._id)
  const deleteFarm = useDeleteFarm()
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()

  // Backend: POST /farms và POST /farms/:id/houses chỉ cho FARM_OWNER
  const canCreateFarm = usePermission('FARM_OWNER')
  const canAddHouse = canCreateFarm

  // Popup thêm nhà: null = đóng, có id = chọn sẵn farm đó
  const [addHouseFarmId, setAddHouseFarmId] = useState<string | null>(null)
  const [showCreateFarm, setShowCreateFarm] = useState(false)
  const [editFarm, setEditFarm] = useState<Farm | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Farm | null>(null)
  // farm đang mở popup áp hồ sơ cấu hình
  const [applyProfileFarm, setApplyProfileFarm] = useState<Farm | null>(null)
  const isPrimaryOf = (farm: Farm) => farm.owner_id === currentUserId

  // Số nhà và thiết bị của từng farm (chặn xoá farm còn thiết bị)
  const statsByFarm = useMemo(() => {
    const stats = new Map<string, { houses: number; devices: number }>()
    for (const node of structure.houses) {
      const current = stats.get(node.farm._id) ?? { houses: 0, devices: 0 }
      stats.set(node.farm._id, {
        houses: current.houses + 1,
        devices: current.devices + node.counts.total,
      })
    }
    return stats
  }, [structure.houses])

  // Nhà trong phạm vi khung lọc (farm, nhà); lọc Zone thì vẫn là nhà chứa Zone đó
  const scopedHouses = useMemo(
    () => structure.houses.filter(node => (!scope.farmId || node.farm._id === scope.farmId) && (!scope.houseId || node.house._id === scope.houseId)),
    [structure.houses, scope.farmId, scope.houseId],
  )
  // Nhà đang hiện của từng farm, nhà ghim sao lên đầu (giữ thứ tự cũ trong từng nhóm)
  const visibleByFarm = useMemo(() => {
    const map = new Map<string, HouseNode[]>()
    const pinnedFirst = [...scopedHouses.filter(node => pinned.has(node.house._id)), ...scopedHouses.filter(node => !pinned.has(node.house._id))]
    for (const node of pinnedFirst) map.set(node.farm._id, [...(map.get(node.farm._id) ?? []), node])
    return map
  }, [scopedHouses, pinned])
  // Farm tạo trước đứng trên, tạo sau nằm cuối (mã Mongo tăng theo thời gian tạo)
  const sortedFarms = useMemo(() => [...(farms ?? [])].sort((left, right) => left._id.localeCompare(right._id)), [farms])
  // Farm đang lọc ở khung lọc; chọn 1 nhà thì chỉ hiện farm có nhà đó
  const shownFarms = useMemo(
    () => sortedFarms.filter(farm => (!scope.farmId || farm._id === scope.farmId) && (!scope.houseId || visibleByFarm.has(farm._id))),
    [sortedFarms, scope.farmId, scope.houseId, visibleByFarm],
  )

  const openHouse = useCallback(
    (node: HouseNode) => navigate(`/farms/${node.farm._id}/houses/${node.house._id}`),
    [navigate],
  )

  function handleDeleteFarm(): void {
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

  if (isError) {
    return (
      <EmptyState
        icon={<WarningCircleIcon size={32} />}
        title={t('state.errorTitle')}
        description={t('state.errorDesc')}
        action={<Button variant="secondary" size="sm" onClick={refetch}>{t('state.retry')}</Button>}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <LoadingSkeleton count={1} className="h-28 w-full" />
        <LoadingSkeleton count={2} className="h-64 w-full" />
      </div>
    )
  }

  // Chưa có trang trại nào: mời tạo farm; có farm mà chưa có nhà thì vẫn hiện danh sách farm để thêm nhà, sửa, xoá
  if (!farms?.length) {
    return (
      <>
        <EmptyState
          title={t('empty.noFarmTitle')}
          description={t('empty.noFarmDesc')}
          action={canCreateFarm ? <Button onClick={() => setShowCreateFarm(true)}>+ {t('empty.createFarm')}</Button> : undefined}
        />
        {showCreateFarm && <FarmFormModal onClose={() => setShowCreateFarm(false)} />}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Khung lọc trên header, dưới xl xuống hàng riêng */}
      <HeaderActions>
        <ScopeFilter scope={routedScope} />
      </HeaderActions>

      {canCreateFarm && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setShowCreateFarm(true)}>
            <PlusIcon size={14} weight="bold" />
            {t('empty.createFarm')}
          </Button>
        </div>
      )}

      {shownFarms.length === 0 ? (
        <EmptyState title={t('empty.noMatchTitle')} description={t('empty.noMatchDesc')} />
      ) : (
        shownFarms.map(farm => {
          const stats = statsByFarm.get(farm._id) ?? { houses: 0, devices: 0 }
          return (
            <FarmBlock
              key={farm._id}
              farm={farm}
              houseCount={stats.houses}
              deviceCount={stats.devices}
              isPrimary={isPrimaryOf(farm)}
              canEdit={canCreateFarm}
              canAddHouse={canAddHouse}
              onEdit={() => setEditFarm(farm)}
              onDelete={() => setDeleteTarget(farm)}
              onAddHouse={() => setAddHouseFarmId(farm._id)}
              onApplyProfile={canCreateFarm && stats.houses > 0 ? () => setApplyProfileFarm(farm) : undefined}
            >
              <HouseTable houses={visibleByFarm.get(farm._id) ?? []} staffByHouse={staffByHouse} pinned={pinned} showYield={canViewHarvest} onTogglePin={togglePin} onOpen={openHouse} />
            </FarmBlock>
          )
        })
      )}

      {addHouseFarmId !== null && (
        <AddHouseModal open onClose={() => setAddHouseFarmId(null)} farms={farms} existingHouses={existingHouses} initialFarmId={addHouseFarmId} />
      )}
      {applyProfileFarm && (
        <ApplyProfileModal
          farm={applyProfileFarm}
          houses={existingHouses.filter(house => house.farm_id === applyProfileFarm._id)}
          onClose={() => setApplyProfileFarm(null)}
        />
      )}
      {showCreateFarm && <FarmFormModal onClose={() => setShowCreateFarm(false)} />}
      {editFarm &&<FarmFormModal farm={editFarm} onClose={() => setEditFarm(null)} />}
      <ConfirmModal
        open={deleteTarget !== null}
        title={t('manage.deleteTitle', { name: deleteTarget?.name ?? NO_VALUE })}
        description={t('manage.deleteDesc')}
        confirmLabel={t('manage.delete')}
        danger
        loading={deleteFarm.isPending}
        onConfirm={handleDeleteFarm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
