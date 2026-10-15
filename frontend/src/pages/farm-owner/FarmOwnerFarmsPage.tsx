import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListIcon, PlusIcon, SquaresFourIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button, EmptyState, FilterChip, SearchInput } from '@/components/ui'
import StableHeight from '@/components/ui/StableHeight'
import Pagination from '@/components/ui/Pagination'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import HouseKpiRow from '@/components/features/farm-owner/farms/HouseKpiRow'
import HouseCard from '@/components/features/farm-owner/farms/HouseCard'
import HouseTable from '@/components/features/farm-owner/farms/HouseTable'
import AddHouseModal from '@/components/features/farm-owner/farms/AddHouseModal'
import CreateFarmModal from '@/components/features/farm-owner/farms/CreateFarmModal'
import { useFarms } from '@/hooks/shared/useFarms'
import { usePinnedHouses } from '@/hooks/farm-owner/usePinnedHouses'
import { useFarmStructure, useStructureExtras } from '@/hooks/farm-owner/useFarmStructure'
import { CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { useScrollToTop } from '@/hooks/common/useScrollToTop'
import { usePermission } from '@/hooks/common/usePermission'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import { vnYearMonth } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import type { HouseHealth, HouseNode } from '@/components/features/farm-owner/farms/farmStructure'

/** Khung kết quả cao CỨNG (px) = bảng 10 dòng × 68px + header — lưới/danh sách/trống đều chiếm đúng chừng này, tải lại hay đổi chế độ trang không đổi chiều cao */
const RESULTS_MIN_HEIGHT = 740
/** Lưới 2 cột × 2 hàng card — vừa trong RESULTS_MIN_HEIGHT; nhiều hơn thì phân trang thay vì kéo dài khung */
const GRID_PAGE_SIZE = 4

type Filter = 'all' | HouseHealth
type View = 'grid' | 'list'

/**
 * Cấu trúc Farm (/farms) — tổng quan mọi nhà yến của các farm user được xem: KPI, lọc theo
 * tình trạng, lưới/danh sách. Dữ liệu thật (farm/house/zone/thiết bị/cảnh báo/thu hoạch/số đo);
 * "người phụ trách" chưa có API → farmMock.api.ts trả rỗng, card hiện "Chưa phân công". Bấm 1 nhà → chi tiết nhà → zone → thiết bị.
 */
export default function FarmOwnerFarmsPage() {
  const { t, num } = useTranslation(farmDict)
  useScrollToTop()
  const navigate = useNavigate()
  const { data: farms } = useFarms()
  const { structure, isLoading, isError, canViewHarvest, refetch } = useFarmStructure()
  const houseIds = useMemo(() => structure.houses.map(h => h.house._id), [structure.houses])
  const { data: extras } = useStructureExtras(houseIds)
  const { pinned, toggle: togglePin } = usePinnedHouses()

  // Backend: POST /farms chỉ cho FARM_OWNER, ADMIN; POST /farms/:id/houses cho cả TECHNICIAN
  const canCreateFarm = usePermission('FARM_OWNER', 'ADMIN')
  const canAddHouse = usePermission('FARM_OWNER', 'TECHNICIAN', 'ADMIN')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<View>('grid')
  const [gridPage, setGridPage] = useState(1)
  const [showAddHouse, setShowAddHouse] = useState(false)
  const [showCreateFarm, setShowCreateFarm] = useState(false)

  // Đếm theo tình trạng + lọc/tìm kiếm trong cùng 1 lượt duyệt
  const { visible, counts } = useMemo(() => {
    const q = search.trim().toLowerCase()
    const counts = { all: 0, ALERT: 0, NORMAL: 0, EMPTY: 0 }
    const visible: HouseNode[] = []
    for (const n of structure.houses) {
      counts.all += 1
      counts[n.health] += 1
      if (filter !== 'all' && n.health !== filter) continue
      if (q) {
        const staff = extras?.houseStaff[n.house._id]?.name ?? ''
        const haystack = `${n.house.name} ${n.farm.name} ${n.farm.address} ${staff}`.toLowerCase()
        if (!haystack.includes(q)) continue
      }
      visible.push(n)
    }
    // Nhà ghim sao lên đầu (giữ thứ tự cũ trong từng nhóm) — chia 2 nhóm bằng 2 lượt lọc, vẫn O(n)
    const pinnedFirst = [...visible.filter(n => pinned.has(n.house._id)), ...visible.filter(n => !pinned.has(n.house._id))]
    return { visible: pinnedFirst, counts }
  }, [structure.houses, search, filter, extras, pinned])

  const openHouse = useCallback(
    (n: HouseNode) => navigate(`/farms/${n.farm._id}/houses/${n.house._id}`),
    [navigate],
  )

  // Kẹp trang lưới theo số trang còn lại khi lọc/tìm kiếm làm ít đi
  const safeGridPage = Math.min(gridPage, Math.max(1, Math.ceil(visible.length / GRID_PAGE_SIZE)))
  const gridRows = visible.slice((safeGridPage - 1) * GRID_PAGE_SIZE, safeGridPage * GRID_PAGE_SIZE)

  const monthLabel = vnYearMonth(new Date()).month

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

  if (structure.houses.length === 0) {
    return (
      <>
        <EmptyState
          title={farms?.length ? t('empty.noHouseTitle') : t('empty.noFarmTitle')}
          description={farms?.length ? t('empty.noHouseDesc') : t('empty.noFarmDesc')}
          action={
            farms?.length
              ? (canAddHouse ? <Button onClick={() => setShowAddHouse(true)}>+ {t('toolbar.addHouse')}</Button> : undefined)
              : (canCreateFarm ? <Button onClick={() => setShowCreateFarm(true)}>+ {t('empty.createFarm')}</Button> : undefined)
          }
        />
        <CreateFarmModal open={showCreateFarm} onClose={() => setShowCreateFarm(false)} />
        <AddHouseModal open={showAddHouse} onClose={() => setShowAddHouse(false)} farms={farms ?? []} />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <HouseKpiRow totals={structure.totals} monthLabel={monthLabel} showYield={canViewHarvest} />

      <FarmFrame
        title={t('list.title')}
        description={t('list.desc', { n: structure.totals.houses })}
        action={(canCreateFarm || canAddHouse) && (
          <div className="flex flex-wrap items-center gap-2">
            {canCreateFarm && (
              <Button variant="secondary" size="sm" className={cn('h-9 text-xs', CAPSULE_ACTION_CLASS)} onClick={() => setShowCreateFarm(true)}>
                <PlusIcon size={14} weight="bold" />
                {t('empty.createFarm')}
              </Button>
            )}
            {canAddHouse && (
              <Button size="sm" className="h-9 text-xs" onClick={() => setShowAddHouse(true)}>
                <PlusIcon size={14} weight="bold" />
                {t('toolbar.addHouse')}
              </Button>
            )}
          </div>
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] max-w-sm flex-1">
            <SearchInput placeholder={t('toolbar.search')} value={search} onChange={setSearch} />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={filter === 'all'} label={`${t('filter.all')} ${num(counts.all)}`} onClick={() => setFilter('all')} />
            <FilterChip active={filter === 'ALERT'} label={`${t('health.alert')} ${num(counts.ALERT)}`} onClick={() => setFilter('ALERT')} />
            <FilterChip active={filter === 'NORMAL'} label={`${t('health.normal')} ${num(counts.NORMAL)}`} onClick={() => setFilter('NORMAL')} />
            <FilterChip active={filter === 'EMPTY'} label={`${t('health.empty')} ${num(counts.EMPTY)}`} onClick={() => setFilter('EMPTY')} />
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-full bg-warmGray/10 p-1" role="group" aria-label={t('toolbar.view')}>
            {([['grid', SquaresFourIcon, 'toolbar.grid'], ['list', ListIcon, 'toolbar.list']] as const).map(([key, ViewIcon, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                  view === key ? 'bg-charcoal text-white' : 'text-warmGray hover:text-charcoal',
                )}
              >
                <ViewIcon size={14} weight="bold" />
                {t(label)}
              </button>
            ))}
          </div>
        </div>

        <StableHeight minHeight={RESULTS_MIN_HEIGHT}>
          {visible.length === 0 ? (
            <EmptyState title={t('empty.noMatchTitle')} description={t('empty.noMatchDesc')} />
          ) : view === 'grid' ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {gridRows.map(n => (
                  <HouseCard
                    key={n.house._id}
                    node={n}
                    staff={extras?.houseStaff[n.house._id]}
                    pinned={pinned.has(n.house._id)}
                    showYield={canViewHarvest}
                    onTogglePin={() => togglePin(n.house._id)}
                    onOpen={() => openHouse(n)}
                  />
                ))}
              </div>
              <Pagination page={safeGridPage} limit={GRID_PAGE_SIZE} total={visible.length} onChange={setGridPage} variant="full" />
            </div>
          ) : (
            <HouseTable houses={visible} staffByHouse={extras?.houseStaff} pinned={pinned} showYield={canViewHarvest} onTogglePin={togglePin} onOpen={openHouse} />
          )}
        </StableHeight>
      </FarmFrame>

      <AddHouseModal open={showAddHouse} onClose={() => setShowAddHouse(false)} farms={farms ?? []} />
      <CreateFarmModal open={showCreateFarm} onClose={() => setShowCreateFarm(false)} />
    </div>
  )
}
