import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HouseIcon, WarningCircleIcon, WarningIcon, WifiHighIcon } from '@phosphor-icons/react'
import { Button, EmptyState, FilterChip, SearchInput } from '@/components/ui'
import KpiTile from '@/components/common/KpiTile'
import Pagination from '@/components/ui/Pagination'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import TechnicianHouseRow from '@/components/features/technician/farms/TechnicianHouseRow'
import { useFarms } from '@/hooks/shared/useFarms'
import { usePendingAlertTotal } from '@/hooks/shared/useAlerts'
import { useFarmStructure } from '@/hooks/farm-owner/useFarmStructure'
import { useZoneStore } from '@/stores/zoneStore'
import { useScrollToTop } from '@/hooks/common/useScrollToTop'
import { useTranslation } from '@/hooks/common/useTranslation'
import { farmDict } from '@/constants/farmStructure.i18n'
import type { HouseHealth, HouseNode } from '@/components/features/farm-owner/farms/farmStructure'

const PAGE_SIZE = 8
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
  // Cùng số với chuông và menu: cảnh báo ACTIVE của các nhà được giao, không tính từ cấu trúc nhà
  const pendingAlerts = usePendingAlertTotal()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(1)

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
  function openDevices(node: HouseNode) {
    setScopePath(node.farm._id, node.farm.name, node.house._id, '')
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

  const { counts: dev } = structure.totals
  // Đã kích hoạt nhưng chưa gửi tín hiệu lần nào: không online, cũng chưa mất kết nối
  const pending = dev.total - dev.online - dev.offline
  // Một thẻ cho thiết bị (W-15): online trên tổng, câu phụ nói việc cần làm
  let devicesSub = t('tech.kpiDevicesStable')
  if (dev.total === 0) devicesSub = t('tech.kpiNoDevices')
  else if (dev.offline > 0) devicesSub = t('tech.kpiDevicesOffline', { n: num(dev.offline) })
  else if (pending > 0) devicesSub = t('tech.kpiDevicesPending', { n: num(pending) })
  const kpis = [
    { icon: HouseIcon, label: t('tech.kpiHouses'), value: num(structure.totals.houses), sub: t('tech.kpiHousesSub', { n: num(structure.totals.zones) }), alert: false },
    {
      icon: WarningIcon, label: t('tech.kpiAttention'), value: num(counts.ALERT),
      sub: pendingAlerts ? t('tech.kpiAlertsPending', { n: num(pendingAlerts) }) : t('tech.kpiNoAlertsPending'), alert: counts.ALERT > 0,
    },
    { icon: WifiHighIcon, label: t('tech.kpiDevices'), value: `${num(dev.online)}/${num(dev.total)}`, sub: devicesSub, alert: dev.offline > 0 },
  ]

  return (
    <div className="flex max-w-screen-xl w-full flex-col gap-6">
      {/* KPI */}
      <FarmFrame title={t('tech.frameTitle')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {kpis.map(k => (
            <KpiTile
              key={k.label}
              icon={k.icon}
              iconClass={k.alert ? 'bg-alertRed/10 text-alertRed' : 'bg-limeMist text-charcoal'}
              alert={k.alert}
              label={k.label}
              value={k.value}
              sub={k.sub}
            />
          ))}
        </div>
      </FarmFrame>

      {/* Danh sách */}
      <FarmFrame title={t('tech.listTitle')} description={t('tech.listDesc')}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] max-w-sm flex-1">
              <SearchInput placeholder={t('toolbar.search')} value={search} onChange={v => { setSearch(v); setPage(1) }} />
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={filter === 'all'} label={`${t('filter.all')} ${num(counts.all)}`} onClick={() => { setFilter('all'); setPage(1) }} />
              <FilterChip active={filter === 'ALERT'} label={t('tech.filterAttention', { n: num(counts.ALERT) })} onClick={() => { setFilter('ALERT'); setPage(1) }} />
              <FilterChip active={filter === 'NORMAL'} label={`${t('health.normal')} ${num(counts.NORMAL)}`} onClick={() => { setFilter('NORMAL'); setPage(1) }} />
              <FilterChip active={filter === 'EMPTY'} label={`${t('health.empty')} ${num(counts.EMPTY)}`} onClick={() => { setFilter('EMPTY'); setPage(1) }} />
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState title={t('empty.noMatchTitle')} description={t('empty.noMatchDesc')} />
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map(n => (
                <TechnicianHouseRow key={n.house._id} node={n} onOpen={() => openDevices(n)} />
              ))}
              <Pagination page={safePage} limit={PAGE_SIZE} total={visible.length} onChange={setPage} variant="full" />
            </div>
          )}
        </div>
      </FarmFrame>
    </div>
  )
}
