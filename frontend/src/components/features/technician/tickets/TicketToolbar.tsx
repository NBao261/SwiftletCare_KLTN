// TicketToolbar.tsx — Tabs + Search + Filter + Sort (card mode) + View Toggle
// Pure presentational component — không giữ state, nhận callback từ parent.
// Wrap bằng memo để tránh re-render khi Page re-render do state modal thay đổi.
import { memo } from 'react'
import type { TechTab, SortKey, SortDir, ViewMode } from './ticketListTypes'
import { TABS, PAGE_SIZE } from './ticketListTypes'
import type { TicketStatus } from '@/types'

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
  // Sort — chỉ hiển thị trong card view
  viewMode: ViewMode
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
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
  return (
    <span className={`ml-1 inline-block text-xs transition-opacity ${active ? 'opacity-100' : 'opacity-30'}`}>
      {active && dir === 'asc' ? '↑' : '↓'}
    </span>
  )
}

export const TicketToolbar = memo(function TicketToolbar({
  activeTab, onTabChange,
  search, onSearchChange,
  filterStatus, onFilterStatusChange,
  viewMode, sortKey, sortDir, onSort,
  onViewModeChange,
  isLoading, resultCount,
  isOverdue, overdueTotal,
}: Props) {
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
                : 'bg-graphite/10 text-charcoal hover:bg-graphite/20'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Filter + View controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative min-w-[200px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-warmGray/60">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Tìm theo loại, ghi chú..."
            className="w-full rounded-xl border border-graphite/20 bg-white py-2.5 pl-9 pr-4 text-sm text-charcoal placeholder:text-warmGray/50 focus:border-charcoal focus:outline-none"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-warmGray/60 hover:text-charcoal"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => onFilterStatusChange(e.target.value as TicketStatus | '')}
          className="rounded-xl border border-graphite/20 bg-white px-3.5 py-2.5 text-sm text-charcoal focus:border-charcoal focus:outline-none"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="NEW">Mới</option>
          <option value="IN_PROGRESS">Đang xử lý</option>
          <option value="AWAITING_FIELD_CONFIRMATION">Chờ xác nhận</option>
          <option value="CLOSED">Đã đóng</option>
        </select>

        {/* Sort buttons — chỉ hiển thị trong card view */}
        {viewMode === 'card' && (
          <div className="flex items-center gap-2 rounded-xl border border-graphite/20 bg-white px-3 py-2">
            <span className="text-xs font-semibold text-warmGray">Sắp xếp:</span>
            {(['priority', 'sla', 'created_at', 'status'] as SortKey[]).map(k => (
              <button
                key={k}
                onClick={() => onSort(k)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  sortKey === k ? 'bg-charcoal text-white' : 'text-warmGray hover:bg-graphite/10'
                }`}
              >
                {SORT_LABELS[k]}
                {sortKey === k && <SortIconInline active dir={sortDir} />}
              </button>
            ))}
          </div>
        )}

        {/* View mode toggle */}
        <div className="flex overflow-hidden rounded-xl border border-graphite/20">
          <button
            onClick={() => onViewModeChange('table')}
            title="Dạng bảng"
            className={`px-3 py-2.5 text-sm transition-colors ${
              viewMode === 'table' ? 'bg-charcoal text-white' : 'bg-white text-warmGray hover:bg-graphite/10'
            }`}
          >
            ☰
          </button>
          <button
            onClick={() => onViewModeChange('card')}
            title="Dạng thẻ"
            className={`px-3 py-2.5 text-sm transition-colors ${
              viewMode === 'card' ? 'bg-charcoal text-white' : 'bg-white text-warmGray hover:bg-graphite/10'
            }`}
          >
            ⊞
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

      {/* Warning: search scope giới hạn trong trang */}
      {(search || filterStatus) && !isOverdue && (
        <p className="rounded-lg border border-climateOrange/20 bg-climateOrange/5 px-3 py-2 text-xs text-warmGray">
          ⚠️ Tìm kiếm và sắp xếp chỉ áp dụng trong trang hiện tại ({PAGE_SIZE} ticket). Dữ liệu ở các trang khác không được tìm.
        </p>
      )}

      {/* Warning: overdue > 100 */}
      {isOverdue && !isLoading && overdueTotal > 100 && (
        <p className="rounded-lg border border-alertRed/20 bg-alertRed/5 px-3 py-2 text-xs text-alertRed">
          ⚠️ Bạn có hơn 100 ticket quá hạn. Danh sách dưới đây chỉ hiển thị 100 ticket gần nhất. Vui lòng xử lý các ticket ưu tiên cao trước.
        </p>
      )}
    </div>
  )
})
