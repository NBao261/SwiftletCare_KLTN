import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PlusIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button, EmptyState, SectionCard } from '@/components/ui'
import StatusTabs from '@/components/common/StatusTabs'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import HealthBadge from '@/components/features/farm-owner/farms/HealthBadge'
import ZoneTable from '@/components/features/farm-owner/farms/ZoneTable'
import HouseProductionCard from '@/components/features/farm-owner/farms/HouseProductionCard'
import HouseStageCard from '@/components/features/farm-owner/farms/HouseStageCard'
import { houseReasonText } from '@/components/features/farm-owner/farms/houseHeadline'
import DeviceListTable from '@/components/features/farm-owner/farms/DeviceListTable'
import DeviceDetailDrawer from '@/components/features/farm-owner/farms/DeviceDetailDrawer'
import FarmMembersManager from '@/components/features/farm-owner/farms/FarmMembersManager'
import AddZoneModal from '@/components/features/farm-owner/farms/AddZoneModal'
import HouseOpsMetricsCard from '@/components/features/farm-owner/work-orders/HouseOpsMetricsCard'
import StructureEditModal from '@/components/features/farm-owner/farms/StructureEditModal'
import ActionsMenu from '@/components/ui/ActionsMenu'
import { useFarmStructure, useHouseStaff, useHouseZoneIds } from '@/hooks/farm-owner/useFarmStructure'
import { usePageBack, usePageBreadcrumb } from '@/hooks/common/useBreadcrumb'
import { useScrollToTop } from '@/hooks/common/useScrollToTop'
import { usePermission } from '@/hooks/common/usePermission'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { DeviceRow, ZoneNode } from '@/components/features/farm-owner/farms/farmStructure'
import ScopeFilter from '@/components/common/ScopeFilter'
import HeaderActions from '@/components/layouts/HeaderActions'
import { FARMS_PATH, useFarmsScopeRouting, useScopeFilter } from '@/hooks/shared/useScopeFilter'
import { UP_FROM_CHILD_STATE } from '@/lib/navigationState'
import { useZoneStore } from '@/stores/zoneStore'

type Tab = 'overview' | 'devices' | 'members'

// Chi tiết 1 nhà yến
export default function FarmOwnerFarmZonesPage() {
  const { farmId, houseId } = useParams<{ farmId: string; houseId: string }>()
  const navigate = useNavigate()
  const { t, num } = useTranslation(farmDict)
  useScrollToTop(houseId)
  const liveZoneIds = useHouseZoneIds(houseId)
  const { structure, isLoading, isError, metricsLoading, canViewHarvest, refetch } = useFarmStructure({ liveZoneIds })
  const node = houseId ? structure.houseById.get(houseId) : undefined
  const pageHouses = useMemo(() => (node ? [node.house] : []), [node])
  const staffByHouse = useHouseStaff(pageHouses)
  // chỉ Farm Owner tạo Zone
  const isFarmOwner = usePermission('FARM_OWNER')
  // MTTA, MTTR: Farm Owner và Domain Expert (kỹ thuật viên nhận 403)
  const canViewOpsMetrics = usePermission('FARM_OWNER', 'DOMAIN_EXPERT')
  // Farm Owner và Domain Expert đổi giai đoạn nhà
  const canSetStage = canViewOpsMetrics

  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'devices' ? 'devices' : 'overview')
  const [showAddZone, setShowAddZone] = useState(false)
  const [selected, setSelected] = useState<DeviceRow | null>(null)
  // Đổi tên / xoá nhà (giao diện dựng sẵn, chờ API backend)
  const [editMode, setEditMode] = useState<'rename' | 'delete' | null>(null)
  // Khung lọc khớp nhà đang xem; đổi lựa chọn thì sang trang đúng cấp
  const scope = useScopeFilter()
  const routedScope = useFarmsScopeRouting(scope)
  const setScopePath = useZoneStore(state => state.setScopePath)
  const farmName = node?.farm.name ?? ''
  useEffect(() => {
    if (farmId && houseId) setScopePath(farmId, farmName, houseId, '')
  }, [farmId, houseId, farmName, setScopePath])
  const scopeFilter = (
    <>
      <HeaderActions>
        <ScopeFilter scope={routedScope} />
      </HeaderActions>
    </>
  )

  usePageBack(FARMS_PATH, t('page.farms'), UP_FROM_CHILD_STATE)
  usePageBreadcrumb(node ? [{ label: node.house.name }] : [], UP_FROM_CHILD_STATE)

  // Gom thiết bị của nhà trong 1 lượt duyệt
  const { devices, zoneNameById, zoneById } = useMemo(() => {
    const devices: DeviceRow[] = []
    const zoneNameById = new Map<string, string>()
    const zoneById = new Map<string, ZoneNode>()
    for (const z of node?.zones ?? []) {
      zoneNameById.set(z.zone._id, z.zone.name)
      zoneById.set(z.zone._id, z)
      for (const d of z.devices) devices.push(d)
    }
    // Camera gắn cả nhà: cột Zone ghi "Cả nhà"
    zoneNameById.set('', t('device.wholeHouse'))
    for (const d of node?.cameraDevices ?? []) devices.push(d)
    return { devices, zoneNameById, zoneById }
  }, [node, t])

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
  if (isLoading) return <LoadingSkeleton count={3} className="h-40 w-full" />
  if (!node) return <EmptyState title={t('house.notFound')} description={t('house.notFoundDesc')} />

  const { house, farm } = node
  const staff = staffByHouse.get(house._id)
  // Lý do nhà đang cảnh báo (vượt ngưỡng, camera mất kết nối...) nằm ngay dưới tên nhà
  const reason = houseReasonText(node, t, num)
  const openZone = (zone: ZoneNode) => navigate(`/farms/${farmId}/houses/${houseId}/zones/${zone.zone._id}`)

  const houseTabs: Array<{ id: Tab; label: string }> = [
    { id: 'overview', label: t('tab.overview') },
    { id: 'devices', label: `${t('tab.devices')} ${node.counts.online}/${node.counts.total}` },
    { id: 'members', label: t('house.members') },
  ]

  return (
    <div className="flex flex-col gap-6">
      {scopeFilter}
      {/* Một thẻ đầu trang: tên nhà, người phụ trách, lý do cảnh báo và các tab */}
      <SectionCard
        title={<>{house.name}<HealthBadge health={node.health} /></>}
        description={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{t('house.staff')}: {staff ? <strong className="text-charcoal">{staff.name}</strong> : <span className="text-warmGray">{t('card.noStaff')}</span>}</span>
            {node.health === 'ALERT' && reason && <span className="font-semibold text-orange-800">{reason}</span>}
          </div>
        }
        action={isFarmOwner && (
          <ActionsMenu
            items={[
              { label: t('structure.rename', { target: t('structure.house') }), onClick: () => setEditMode('rename') },
              { label: t('structure.delete', { target: t('structure.house') }), onClick: () => setEditMode('delete'), danger: true },
            ]}
          />
        )}
      >
        <StatusTabs variant="underline" ariaLabel={house.name} value={tab} onChange={setTab} tabs={houseTabs} />
      </SectionCard>

      {tab === 'overview' ? (
        <div className="flex flex-col gap-6">
          <FarmFrame
            title={t('house.zoneList', { n: node.zones.length })}
            action={isFarmOwner && (
              <Button variant="secondary" size="sm" onClick={() => setShowAddZone(true)}>
                <PlusIcon size={14} weight="bold" />
                {t('house.addZone')}
              </Button>
            )}
          >
            <ZoneTable zones={node.zones} loadingMetrics={metricsLoading} onOpen={openZone} />
          </FarmFrame>

          {/* Giai đoạn nhà, sản lượng và xử lý sự cố: ba thẻ ngang bằng nhau dưới bảng Zone */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <HouseStageCard house={house} canEdit={canSetStage} />
            {canViewHarvest && <HouseProductionCard node={node} recent={node.recent} />}
            {canViewOpsMetrics && <HouseOpsMetricsCard farmId={farm._id} houseId={house._id} />}
          </div>
        </div>
      ) : tab === 'members' ? (
        <FarmMembersManager farmId={farm._id} houseId={house._id} />
      ) : (
        <FarmFrame title={t('house.devicesTitle', { n: devices.length })} help={t('zone.devicesDesc')}>
          <DeviceListTable devices={devices} zoneNameById={zoneNameById} onSelect={setSelected} />
        </FarmFrame>
      )}

      <AddZoneModal open={showAddZone} onClose={() => setShowAddZone(false)} houseId={house._id} />
      {editMode && <StructureEditModal kind="house" mode={editMode} id={house._id} onDeleted={() => navigate('/farms')} name={house.name} deviceCount={node.counts.total} existingNames={structure.houses.map(item => item.house.name)} onClose={() => setEditMode(null)} />}
      <DeviceDetailDrawer device={selected} zoneNode={selected ? zoneById.get(selected.zoneId) : undefined} onClose={() => setSelected(null)} />
      {/* Yêu cầu lắp đặt / báo lỗi mở ngay tại trang, gửi xong popup báo kết quả */}
    </div>
  )
}
