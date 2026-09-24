// TicketToolbar.tsx — Tabs + Search + Filter + Sort (card mode) + View Toggle
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

interface Props {
  // Tab
  activeTab: TechTab
  onTabChange: (tab: TechTab) => void
  // Search
  search: string
  onSearchChange: (val: string) => void
  // Filter
  filterStatus: TicketStatus | ''
  onFilterStatusChange: (val: TicketStatus | '') => void
  // Sort — hiển thị trong cả table và card view (nhất quán với Admin)
  viewMode: ViewMode
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  onClearFilters: () => void
  // View mode toggle
  onViewModeChange: (mode: ViewMode) => void
  // Result count
  isLoading: boolean
  resultCount: number
  // Warnings
  isOverdue: boolean
  overdueTotal: number
}

const SORT_LABELS: Record<SortKey, string> = {
  priority: 'Ưu tiên', sla: 'SLA', created_at: 'Ngày', status: 'Trạng thái',
}

function SortIconInline({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <IconSortDesc width={12} height={12} className="ml-1 opacity-30" />
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
  const hasActiveFilters = search !== '' || filterStatus !== '' || sortKey !== 'priority' || sortDir !== 'asc'
  return (
    <div className="flex flex-col gap-3">
      {/* Tab pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-charcoal text-white'
                : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Hàng 1: Search + View controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
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

        {/* Result count */}
        {!isLoading && (
          <span className="text-sm text-warmGray">
            {resultCount} kết quả
            {(search || filterStatus) && (
              <span className="ml-1 text-xs text-warmGray/70">(đã lọc)</span>
            )}
          </span>
        )}
      </div>

      {/* Hàng 2: Filter + Sort + Hủy lọc */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter — Dùng FilterChip pill */}
        <div className="flex flex-nowrap gap-2">
          <FilterChip active={filterStatus === ''} label="Tất cả" onClick={() => onFilterStatusChange('')} />
          {FILTERABLE_STATUSES.map(s => (
            <FilterChip key={s} active={filterStatus === s} label={STATUS_LABEL[s]} onClick={() => onFilterStatusChange(s)} />
          ))}
        </div>

        {/* Sort buttons — giống AdminUsersPage, không có container border bọc ngoài */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-caption">Sắp xếp:</span>
          {(['priority', 'sla', 'created_at', 'status'] as SortKey[]).map(k => {
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
                {active && <SortIconInline active={true} dir={sortDir} />}
              </button>
            )
          })}
        </div>

        {/* Nút hủy lọc */}
        {hasActiveFilters && (
          <Button variant="danger" size="sm" className="h-8 px-3.5 text-xs" onClick={onClearFilters}>Hủy lọc</Button>
        )}
      </div>

      {/* Warning: search scope giới hạn trong trang */}
      {(search || filterStatus) && !isOverdue && (
        <p className="-mt-2 text-xs text-climateOrange">
          Tìm kiếm và sắp xếp chỉ áp dụng trong trang hiện tại ({PAGE_SIZE} ticket). Dữ liệu ở các trang khác không được tìm.
        </p>
      )}

      {/* Warning: overdue > 100 */}
      {isOverdue && !isLoading && overdueTotal > 100 && (
        <p className="-mt-2 text-xs text-alertRed">
          Bạn có hơn 100 ticket quá hạn. Danh sách dưới đây chỉ hiển thị 100 ticket gần nhất. Vui lòng xử lý các ticket ưu tiên cao trước.
        </p>
      )}
    </div>
  )
})
