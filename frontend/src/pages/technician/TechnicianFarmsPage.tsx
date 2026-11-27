import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { Button, EmptyState, SearchInput, SectionCard } from '@/components/ui'
import StatusTabs from '@/components/common/StatusTabs'
import Pagination from '@/components/ui/Pagination'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import TechnicianHouseRow, { HOUSE_ROW_GRID } from '@/components/features/technician/farms/TechnicianHouseRow'
import { useFarms } from '@/hooks/shared/useFarms'
import { useFarmStructure } from '@/hooks/farm-owner/useFarmStructure'
import { useZoneStore } from '@/stores/zoneStore'
import { useScrollToTop } from '@/hooks/common/useScrollToTop'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { HouseHealth, HouseNode } from '@/components/features/farm-owner/farms/farmStructure'

const PAGE_SIZE = 8
// Vài nhà thì nhìn là thấy hết; ô tìm chỉ hiện khi nhiều
const SEARCH_FROM = 6
type Filter = 'all' | HouseHealth

// Nhà cần xử lý lên đầu, rồi bình thường, cuối cùng là nhà chưa có thiết bị
const HEALTH_ORDER: Record<HouseHealth, number> = { ALERT: 0, NORMAL: 1, EMPTY: 2 }

// Nhà được giao (/farms) của Farm Technician: thiết bị và cảnh báo đang mở của từng nhà, bấm để xem thiết bị
export default function TechnicianFarmsPage() {
  const { t, num } = useTranslation(farmDict)
  useScrollToTop()
  const navigate = useNavigate()
  const setScopePath = useZoneStore(state => state.setScopePath)
  const { data: farms } = useFarms()
  const { structure, isLoading, isError, refetch } = useFarmStructure()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)
  // Nhà đã bấm mở hoặc đóng; chưa bấm thì nhà cần xử lý mở sẵn các Zone
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const { visible, counts } = useMemo(() => {
    const q = search.trim().toLowerCase()
    const counts = { all: 0, ALERT: 0, NORMAL: 0, EMPTY: 0 }
    const visible: HouseNode[] = []
    for (const n of structure.houses) {
      counts.all += 1
      counts[n.health] += 1
      if (filter !== 'all' && n.health !== filter) continue
      if (q && !`${n.house.name} ${n.farm.name} ${n.farm.address}`.toLowerCase().includes(q)) continue
      visible.push(n)
    }
    visible.sort((a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health] || b.alerts.length - a.alerts.length)
    return { visible, counts }
  }, [structure.houses, search, filter])

  // Mở trang Thiết bị đã lọc sẵn nhà này (phạm vi lưu trong store, không đưa mã vào URL: FE_Design 13.16)
  function openDevices(node: HouseNode, zoneId = '') {
    setScopePath(node.farm._id, node.farm.name, node.house._id, zoneId)
    navigate('/devices')
  }

  const safePage = Math.min(page, Math.max(1, Math.ceil(visible.length / PAGE_SIZE)))
  const rows = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

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
        <LoadingSkeleton count={1} className="h-24 w-full" />
        <LoadingSkeleton count={3} className="h-28 w-full" />
      </div>
    )
  }

  if (structure.houses.length === 0) {
    return (
      <EmptyState
        title={farms?.length ? t('empty.noHouseTitle') : t('tech.noFarmTitle')}
        description={t('tech.noFarmDesc')}
      />
    )
  }

  return (
    <div className="flex w-full max-w-screen-xl flex-col gap-6">
      <SectionCard description={t('tech.listDesc')}>
        {/* Số nhà mỗi nhóm nằm ngay trên tab; chỉ nhóm cần xử lý mới có số nổi */}
        <StatusTabs
          variant="underline"
          ariaLabel={t('tech.listTitle')}
          value={filter}
          onChange={id => { setFilter(id); setPage(1) }}
          tabs={[
            { id: 'all', label: `${t('filter.all')} (${num(counts.all)})` },
            { id: 'ALERT', label: t('tech.tabAttention'), badge: counts.ALERT },
            { id: 'NORMAL', label: `${t('health.normal')} (${num(counts.NORMAL)})` },
            { id: 'EMPTY', label: `${t('health.empty')} (${num(counts.EMPTY)})` },
          ]}
        />

        {structure.houses.length > SEARCH_FROM && (
          <div className="max-w-sm">
            <SearchInput placeholder={t('toolbar.search')} value={search} onChange={v => { setSearch(v); setPage(1) }} />
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState title={t('empty.noMatchTitle')} description={t('empty.noMatchDesc')} />
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-warmGray/15 bg-white">
              <div className={`hidden gap-x-6 border-b border-warmGray/15 bg-warmGray/5 px-5 py-2.5 text-xs font-semibold text-warmGray lg:grid ${HOUSE_ROW_GRID}`}>
                <span>{t('tech.colHouse')}</span>
                <span>{t('tech.colStatus')}</span>
                <span>{t('roster.mine')}</span>
                <span>{t('stat.online')}</span>
                <span />
              </div>
              {rows.map(n => (
                <TechnicianHouseRow
                  key={n.house._id}
                  node={n}
                  isOpen={expanded[n.house._id] ?? n.health === 'ALERT'}
                  onToggle={() => setExpanded(prev => ({ ...prev, [n.house._id]: !(prev[n.house._id] ?? n.health === 'ALERT') }))}
                  onOpenDevices={zoneId => openDevices(n, zoneId)}
                />
              ))}
            </div>
            <Pagination page={safePage} limit={PAGE_SIZE} total={visible.length} onChange={setPage} variant="full" />
          </>
        )}
      </SectionCard>
    </div>
  )
}
