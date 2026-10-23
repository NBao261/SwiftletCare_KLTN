import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button, ClearFiltersButton, EmptyState, LoadingSkeleton, SearchInput, SelectMenu } from '@/components/ui'
import FixedRowsTable from '@/components/ui/FixedRowsTable'
import TableEmptyState from '@/components/common/TableEmptyState'
import FarmFrame from '@/components/features/farm-owner/farms/FarmFrame'
import TicketKpiRow from '@/components/features/farm-owner/tickets/TicketKpiRow'
import CreateSupportTicketModal, { type CreateSupportDefaults } from '@/components/features/farm-owner/tickets/CreateSupportTicketModal'
import { buildTicketColumns } from '@/components/features/farm-owner/tickets/ticketColumns'
import DeviceFaultAlertPanel from '@/components/features/farm-owner/tickets/DeviceFaultAlertPanel'
import {
  ALERT_TO_TICKET_TYPE, PAGE_SIZE, SUPPORT_DETAIL_PATH,
  type SupportDetailState,
} from '@/components/features/farm-owner/tickets/tickets.constants'
import { useTicketsList } from '@/hooks/shared/useTickets'
import { useTicketCounts } from '@/hooks/farm-owner/useTicketCounts'
import { useDeviceFaultAlerts } from '@/hooks/farm-owner/useDeviceFaultAlerts'
import { useAllZones, useFarms } from '@/hooks/shared/useFarms'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { supportDict } from '@/constants/support.i18n'
import { TICKET_STATUS_ORDER } from '@/constants/ticketStatus'
import { PRIORITIES } from '@/constants/priority'
import { levelDict } from '@/constants/severity.i18n'
import type { PaginationLabels } from '@/components/ui/Pagination'
import type { Alert, TicketPriority, TicketStatus } from '@/types'

type StatusFilter = '' | TicketStatus
type PriorityFilter = '' | TicketPriority
// Chiều cao 1 dòng bảng — bảng luôn giữ đủ PAGE_SIZE dòng
const ROW_HEIGHT = 68
// Ô lọc: rộng theo chữ trong khoảng 80–220px, cao bằng nút Hủy lọc
const FILTER_SELECT_CLASS = 'h-9 min-w-[80px] max-w-[220px] justify-between px-3.5 font-medium'
const FILTER_CLEAR_CLASS = 'h-9'

// Trang danh sách yêu cầu hỗ trợ của Farm Owner
export default function FarmOwnerTicketsPage() {
  const { t } = useTranslation(supportDict)
  const { t: tLevel } = useTranslation(levelDict)
  const navigate = useNavigate()
  const apiErrorMessage = useApiErrorMessage()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('')
  const [farmFilter, setFarmFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [createDefaults, setCreateDefaults] = useState<CreateSupportDefaults>()
  // Gõ tới đâu gọi API tới đó sẽ dồn request — để React hoãn giá trị tìm kiếm khi người dùng đang gõ
  const deferredSearch = useDeferredValue(search.trim())

  function openCreate() {
    setCreateDefaults(undefined)
    setShowCreate(true)
  }

  const counts = useTicketCounts()
  const { records, total, isLoading, isError, error, refetch } = useTicketsList({
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    farmId: farmFilter || undefined,
    search: deferredSearch || undefined,
    page,
    limit: PAGE_SIZE,
  })

  const faults = useDeviceFaultAlerts()
  const { data: farms } = useFarms()
  const { data: zones } = useAllZones()
  // Ticket/cảnh báo chỉ trả id thô — tra tên farm, "Nhà / Zone" 1 lần cho cả bảng lẫn khung báo lỗi
  const lookups = useMemo(() => {
    const farmById = new Map((farms ?? []).map(farm => [farm._id, farm.name]))
    const zoneById = new Map((zones ?? []).map(zone => [zone._id, `${zone.houseName} / ${zone.name}`]))
    return {
      farmName: (id: string) => farmById.get(id),
      zoneLabel: (id?: string) => (id ? zoneById.get(id) : undefined),
    }
  }, [farms, zones])
  // Thao tác ⋯: xem chi tiết, hoặc vào chi tiết mở sẵn khung trao đổi
  const columns = useMemo(() => buildTicketColumns({
    ...lookups,
    translate: t,
    onView: ticket => navigate(SUPPORT_DETAIL_PATH, { state: { ticketId: ticket._id } satisfies SupportDetailState }),
    onChat: ticket => navigate(SUPPORT_DETAIL_PATH, { state: { ticketId: ticket._id, openChat: true } satisfies SupportDetailState }),
    startIndex: (page - 1) * PAGE_SIZE,
  }), [lookups, t, navigate, page])
  const pagerLabels = useMemo<PaginationLabels>(() => ({
    summary: (from, to, total) => t('pager.summary', { from, to, total }),
    nav: t('pager.nav'),
    first: t('pager.first'),
    prev: t('pager.prev'),
    page: pageNumber => t('pager.page', { pageNumber }),
    next: t('pager.next'),
    last: t('pager.last'),
  }), [t])

  // Tạo yêu cầu từ cảnh báo lỗi thiết bị, điền sẵn loại, farm, zone và mô tả
  function createFromAlert(alert: Alert, summary: string) {
    setCreateDefaults({
      kind: 'fault',
      type: ALERT_TO_TICKET_TYPE[alert.type] ?? 'OTHER',
      farmId: alert.farm_id,
      zoneId: alert.zone_id,
      description: summary,
      alertId: alert._id,
    })
    setShowCreate(true)
  }

  // Số điều kiện lọc đang bật — hiện trên nút Hủy
  const activeFilterCount = [statusFilter, priorityFilter, farmFilter, deferredSearch].filter(value => value !== '').length
  const isFiltering = activeFilterCount > 0

  function changeStatusFilter(next: StatusFilter) {
    setStatusFilter(next)
    setPage(1)
  }

  function changeFarmFilter(next: string) {
    setFarmFilter(next)
    setPage(1)
  }

  function changePriorityFilter(next: PriorityFilter) {
    setPriorityFilter(next)
    setPage(1)
  }

  // Nút Hủy lọc: về lại toàn bộ danh sách
  function clearFilters() {
    setStatusFilter('')
    setPriorityFilter('')
    setFarmFilter('')
    setSearch('')
    setPage(1)
  }

  function changeSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  // Nhãn lọc trạng thái kèm số ticket — chỉ kèm số khi đã tải được số liệu
  const hasCounts = !counts.isLoading && !counts.isError
  function statusOptionLabel(label: string, count: number): string {
    if (!hasCounts) return label
    return `${label} (${count})`
  }

  // Lựa chọn lọc trạng thái và mức ưu tiên (nhãn 3 cấp chung)
  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: '', label: statusOptionLabel(t('list.allStatuses'), counts.all) },
    ...TICKET_STATUS_ORDER.map(status => ({ value: status, label: statusOptionLabel(t(`status.${status}`), counts[status]) })),
  ]
  const priorityOptions: Array<{ value: PriorityFilter; label: string }> = [
    { value: '', label: t('list.allPriorities') },
    ...PRIORITIES.map(priority => ({ value: priority, label: tLevel(priority) })),
  ]
  const farmOptions = [
    { value: '', label: t('list.allFarms') },
    ...(farms ?? []).map(farm => ({ value: farm._id, label: farm.name })),
  ]

  return (
    <div className="flex flex-col gap-6">
      {counts.isLoading ? <LoadingSkeleton className="h-36 w-full" /> : <TicketKpiRow counts={counts} />}

      <DeviceFaultAlertPanel
        rows={faults.rows}
        byLevel={faults.byLevel}
        farmName={lookups.farmName}
        zoneLabel={lookups.zoneLabel}
        onCreateTicket={createFromAlert}
      />

      <FarmFrame
        title={t('list.title')}
        action={
          <Button size="sm" className="h-9" onClick={openCreate}>
            <PlusIcon size={14} weight="bold" />
            {t('list.create')}
          </Button>
        }
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Bộ lọc: chọn trạng thái, mức ưu tiên; có lọc thì hiện nút Hủy lọc */}
          <div className="flex flex-wrap items-center gap-2">
            <SelectMenu ariaLabel={t('list.filterStatus')} value={statusFilter} onChange={changeStatusFilter} options={statusOptions} className={FILTER_SELECT_CLASS} />
            <SelectMenu ariaLabel={t('list.filterPriority')} value={priorityFilter} onChange={changePriorityFilter} options={priorityOptions} className={FILTER_SELECT_CLASS} />
            <SelectMenu ariaLabel={t('list.filterFarm')} value={farmFilter} onChange={changeFarmFilter} options={farmOptions} className={FILTER_SELECT_CLASS} />
            {isFiltering && <ClearFiltersButton onClick={clearFilters} label={t('list.clearFilters')} count={activeFilterCount} tone="danger" className={FILTER_CLEAR_CLASS} />}
          </div>
          <div className="w-full lg:w-72">
            <SearchInput value={search} onChange={changeSearch} placeholder={t('list.search')} />
          </div>
        </div>

        {isError ? (
          <EmptyState
            icon={<WarningCircleIcon size={32} />}
            title={t('list.errorTitle')}
            description={apiErrorMessage(error)}
            action={<Button variant="secondary" size="sm" onClick={() => void refetch()}>{t('common.retry')}</Button>}
          />
        ) : isLoading ? (
          <LoadingSkeleton count={PAGE_SIZE} className="h-[68px] w-full" />
        ) : (
          // Bảng luôn 10 dòng: thiếu thì đệm dòng trống, không có ticket thì dòng đầu hiện thông báo
          <FixedRowsTable
            columns={columns}
            rows={records}
            getRowKey={ticket => ticket._id}
            rowHeight={ROW_HEIGHT}
            pageSize={PAGE_SIZE}
            emptyNotice={isFiltering ? t('list.emptyFilteredTitle') : t('list.emptyTitle')}
            emptyContent={
              <TableEmptyState
                title={isFiltering ? t('list.emptyFilteredTitle') : t('list.emptyTitle')}
                description={isFiltering ? t('list.emptyFilteredHint') : t('list.emptyHint')}
              />
            }
            paginationLabels={pagerLabels}
            serverPagination={{ page, total, onChange: setPage }}
          />
        )}
      </FarmFrame>

      <CreateSupportTicketModal open={showCreate} onClose={() => setShowCreate(false)} defaults={createDefaults} />
    </div>
  )
}
