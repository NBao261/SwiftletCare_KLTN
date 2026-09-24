// TicketToolbar.tsx — Search + Unified Filter (status + overdue chip) + Sort + View Toggle
// Đã loại bỏ 3 tab cũ (Tất cả của tôi / Đang xử lý / Quá hạn SLA).
// Thay bằng hàng FilterChip duy nhất bao gồm cả chip "Quá hạn SLA" đặc biệt.
import { memo } from 'react'
import { Input, Button, FilterChip } from '@/components/ui'
import { IconSearch, IconSortAsc, IconSortDesc } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import type { SortKey, SortDir } from './ticketListTypes'
import type { TicketStatus } from '@/types'
import { STATUS_LABEL } from '@/constants/tickets'

/** Các status có thể lọc — không bao gồm CLOSED vì overdue thường chỉ ở trạng thái active */
const FILTERABLE_STATUSES: TicketStatus[] = ['NEW', 'IN_PROGRESS', 'AWAITING_FIELD_CONFIRMATION', 'CLOSED']

/**
 * Sort keys hợp lệ theo context:
 * - Khi overdue active: sort Trạng thái ít nghĩa (tập trung vào SLA/Priority)
 * - Khi filterStatus = IN_PROGRESS: tất cả cùng status → ẩn sort Trạng thái
 * - Còn lại: hiển thị đủ 4 keys
 */
function getValidSortKeys(isOverdueActive: boolean, filterStatus: TicketStatus | ''): SortKey[] {
  if (isOverdueActive || filterStatus === 'IN_PROGRESS') return ['sla', 'created_at']
  return ['sla', 'created_at', 'status']
}

interface Props {
  // Filter thống nhất
  isOverdueActive: boolean
  onOverdueToggle: () => void
  filterStatus: TicketStatus | ''
  onFilterStatusChange: (val: TicketStatus | '') => void
  // Search
  search: string
  onSearchChange: (val: string) => void
  // Sort
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  onClearFilters: () => void

  // Meta
  isLoading: boolean
  overdueTotal: number
}

const SORT_LABELS: Record<SortKey, string> = {
  sla: 'SLA', created_at: 'Ngày', status: 'Trạng thái',
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return null
  return dir === 'asc'
    ? <IconSortAsc width={12} height={12} className="ml-1" />
    : <IconSortDesc width={12} height={12} className="ml-1" />
}

export const TicketToolbar = memo(function TicketToolbar({
  isOverdueActive, onOverdueToggle,
  filterStatus, onFilterStatusChange,
  search, onSearchChange,
  sortKey, sortDir, onSort, onClearFilters,
  isLoading,
  overdueTotal,
}: Props) {
  const validSortKeys = getValidSortKeys(isOverdueActive, filterStatus)

  // Có đang áp dụng bộ lọc nào không (để hiển thị nút "Hủy lọc")
  const hasActiveFilters =
    search !== '' ||
    filterStatus !== '' ||
    isOverdueActive ||
    sortKey !== 'created_at' ||
    sortDir !== 'desc'

  return (
    <div className="flex flex-col gap-3">

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




      </div>

      {/* ── Hàng 2: Unified FilterChips + Hủy lọc (Trái) & Sort (Phải) ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        
        <div className="flex flex-wrap items-center gap-3">
          {/*
            FilterChips thống nhất — thay thế hoàn toàn 3 tab cũ:
            [Tất cả] [Mới] [Đang xử lý] [Chờ xác nhận] [Đã đóng] [🔴 Quá hạn SLA]
            - Các chips status và chip Quá hạn SLA là loại trừ lẫn nhau (radio).
            - Click chip status → tắt overdue mode nếu đang bật, set filterStatus.
            - Click "Quá hạn SLA" → tắt filterStatus, bật overdue mode.
          */}
          <div className="flex flex-wrap gap-2">
            {/* Chip "Tất cả" — active khi không có filter nào được chọn */}
            <FilterChip
              active={!isOverdueActive && filterStatus === ''}
              label="Tất cả"
              onClick={() => {
                if (isOverdueActive) onOverdueToggle()
                onFilterStatusChange('')
              }}
            />
            {/* Chips theo status */}
            {FILTERABLE_STATUSES.map(s => (
              <FilterChip
                key={s}
                active={!isOverdueActive && filterStatus === s}
                label={STATUS_LABEL[s]}
                onClick={() => {
                  if (isOverdueActive) onOverdueToggle()
                  onFilterStatusChange(s)
                }}
              />
            ))}
            {/* Chip đặc biệt: Quá hạn SLA */}
            <FilterChip
              active={isOverdueActive}
              label="🔴 Quá hạn SLA"
              onClick={onOverdueToggle}
            />
          </div>

          {hasActiveFilters && (
            <Button variant="danger" size="sm" className="h-8 px-3.5 text-xs" onClick={onClearFilters}>
              Hủy lọc
            </Button>
          )}
        </div>

        {/* Sort buttons — keys hợp lệ thay đổi theo context */}
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
                <SortIcon active={active} dir={sortDir} />
              </button>
            )
          })}
        </div>
      </div>



      {/* Cảnh báo: overdue > 100 ticket */}
      {isOverdueActive && !isLoading && overdueTotal > 100 && (
        <p className="-mt-2 text-xs text-alertRed">
          Bạn có hơn 100 ticket quá hạn. Danh sách dưới đây chỉ hiển thị 100 ticket gần nhất. Vui lòng xử lý các ticket ưu tiên cao trước.
        </p>
      )}
    </div>
  )
})
