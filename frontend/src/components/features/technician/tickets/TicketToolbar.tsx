// TicketToolbar.tsx — Tabs + Search + Filter + Sort + View Toggle
// Pure presentational component — không giữ state, nhận callback từ parent.
// Wrap bằng memo để tránh re-render khi Page re-render do state modal thay đổi.
import { memo } from 'react'
import { Input, Button, FilterChip } from '@/components/ui'
import { IconSearch, IconSortAsc, IconSortDesc, IconList, IconGrid } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { TechTab, SortKey, SortDir, ViewMode } from './ticketListTypes'
import { TABS, PAGE_SIZE } from './ticketListTypes'
import type { TicketStatus } from '@/types'
import { STATUS_LABEL } from '@/constants/tickets'

const FILTERABLE_STATUSES: TicketStatus[] = ['NEW', 'IN_PROGRESS', 'AWAITING_FIELD_CONFIRMATION', 'CLOSED']

/**
 * Sort keys hợp lệ theo từng tab:
 * - 'mine'        → tất cả status → cho phép sort theo cả Trạng thái
 * - 'in_progress' → API đã lock status = IN_PROGRESS → ẩn sort Trạng thái (vô nghĩa)
 * - 'overdue'     → tập trung vào SLA/Ưu tiên → ẩn sort Trạng thái
 */
const SORT_KEYS_BY_TAB: Record<TechTab, SortKey[]> = {
  mine:        ['priority', 'sla', 'created_at', 'status'],
  in_progress: ['priority', 'sla', 'created_at'],
  overdue:     ['priority', 'sla', 'created_at'],
}

interface Props {
  activeTab: TechTab
  onTabChange: (tab: TechTab) => void
  search: string
  onSearchChange: (val: string) => void
  // Filter status — chỉ hiển thị khi tab không lock status sẵn
  filterStatus: TicketStatus | ''
  onFilterStatusChange: (val: TicketStatus | '') => void
  viewMode: ViewMode
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  onClearFilters: () => void
  onViewModeChange: (mode: ViewMode) => void
  isLoading: boolean
  resultCount: number
  isOverdue: boolean
  overdueTotal: number
}

const SORT_LABELS: Record<SortKey, string> = {
  priority: 'Ưu tiên', sla: 'SLA', created_at: 'Ngày', status: 'Trạng thái',
}

function SortIconInline({ dir }: { dir: SortDir }) {
  return dir === 'asc'
    ? <IconSortAsc width={12} height={12} className="ml-1" />
    : <IconSortDesc width={12} height={12} className="ml-1" />
}

export const TicketToolbar = memo(function TicketToolbar({
  activeTab, onTabChange,
  search, onSearchChange,
  filterStatus, onFilterStatusChange,
  viewMode, sortKey, sortDir, onSort, onClearFilters,
  onViewModeChange,
  isLoading, resultCount,
  isOverdue, overdueTotal,
}: Props) {
  // Tab 'in_progress' đã lock status=IN_PROGRESS qua API → FilterChips status là dư thừa
  const showStatusFilter = activeTab !== 'in_progress'
  // Sort keys hợp lệ theo context của tab hiện tại
  const validSortKeys = SORT_KEYS_BY_TAB[activeTab]
  // Nút "Hủy lọc" chỉ hiện khi thực sự có filter/sort khác mặc định
  const hasActiveFilters =
    search !== '' ||
    (showStatusFilter && filterStatus !== '') ||
    sortKey !== 'priority' ||
    sortDir !== 'asc'

  return (
    <div className="flex flex-col gap-3">

      {/* ── Tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-charcoal text-white'
                : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20'
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Hàng 1: Search + View mode toggle + Result count ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <Input
            icon={<IconSearch width={16} height={16} />}
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Tìm theo loại, ghi chú..."
          />
        </div>

        {/* View mode toggle */}
        <div className="flex overflow-hidden rounded-xl border border-warmGray/20">
          <button
            onClick={() => onViewModeChange('table')}
            title="Dạng bảng"
            className={cn(
              'px-3 py-2 transition-colors',
              viewMode === 'table' ? 'bg-charcoal text-white' : 'bg-white text-warmGray hover:bg-warmGray/10'
            )}
          >
            <IconList width={16} height={16} />
          </button>
          <button
            onClick={() => onViewModeChange('card')}
            title="Dạng thẻ"
            className={cn(
              'px-3 py-2 transition-colors',
              viewMode === 'card' ? 'bg-charcoal text-white' : 'bg-white text-warmGray hover:bg-warmGray/10'
            )}
          >
            <IconGrid width={16} height={16} />
          </button>
        </div>

        {!isLoading && (
          <span className="text-sm text-warmGray">
            {resultCount} kết quả
            {hasActiveFilters && <span className="ml-1 text-xs text-warmGray/70">(đã lọc)</span>}
          </span>
        )}
      </div>

      {/* ── Hàng 2: Filter Status + Sort + Hủy lọc ── */}
      <div className="flex flex-wrap items-center gap-3">

        {/*
          Status FilterChips — CHỈ hiển thị khi tab KHÔNG lock status sẵn.
          - Tab 'mine': tất cả status → cần lọc → HIỆN chips
          - Tab 'in_progress': API đã lọc IN_PROGRESS → ẨN chips (dư thừa & gây nhầm)
          - Tab 'overdue': các status có thể khác nhau → HIỆN chips
        */}
        {showStatusFilter && (
          <div className="flex flex-nowrap gap-2">
            <FilterChip
              active={filterStatus === ''}
              label="Tất cả"
              onClick={() => onFilterStatusChange('')}
            />
            {FILTERABLE_STATUSES.map(s => (
              <FilterChip
                key={s}
                active={filterStatus === s}
                label={STATUS_LABEL[s]}
                onClick={() => onFilterStatusChange(s)}
              />
            ))}
          </div>
        )}

        {/*
          Sort buttons — chỉ hiển thị keys CÓ Ý NGHĨA với tab đang active.
          - Sort "Trạng thái" bị ẩn ở 'in_progress' và 'overdue' vì kết quả đã đồng nhất.
        */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-caption">Sắp xếp:</span>
          {validSortKeys.map(k => {
            const active = sortKey === k
            return (
              <button
                key={k}
                onClick={() => onSort(k)}
                className={cn(
                  'inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  active ? 'bg-charcoal text-white' : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20'
                )}
              >
                {SORT_LABELS[k]}
                {active && <SortIconInline dir={sortDir} />}
              </button>
            )
          })}
        </div>

        {hasActiveFilters && (
          <Button variant="danger" size="sm" className="h-8 px-3.5 text-xs" onClick={onClearFilters}>
            Hủy lọc
          </Button>
        )}
      </div>

      {/* Cảnh báo: search/filter chỉ áp dụng trong trang hiện tại */}
      {(search || (showStatusFilter && filterStatus)) && !isOverdue && (
        <p className="-mt-2 text-xs text-climateOrange">
          Tìm kiếm và lọc chỉ áp dụng trong trang hiện tại ({PAGE_SIZE} ticket). Dữ liệu ở các trang khác không được tìm.
        </p>
      )}

      {/* Cảnh báo: overdue > 100 ticket */}
      {isOverdue && !isLoading && overdueTotal > 100 && (
        <p className="-mt-2 text-xs text-alertRed">
          Bạn có hơn 100 ticket quá hạn. Danh sách dưới đây chỉ hiển thị 100 ticket gần nhất. Vui lòng xử lý các ticket ưu tiên cao trước.
        </p>
      )}
    </div>
  )
})
