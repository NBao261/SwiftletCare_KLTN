import { ClearFiltersButton, SearchInput, SelectMenu, SortChips } from '@/components/ui'
import type { SortChipField } from '@/components/ui/SortChips'
import type { SortDirection } from '@/types'

export type DeviceSortKey = 'last_heartbeat' | 'device_id' | 'rssi'

export const DEVICE_SORT_FIELDS: SortChipField<DeviceSortKey>[] = [
  { key: 'last_heartbeat', label: 'Heartbeat' },
  { key: 'device_id', label: 'Mã thiết bị' },
  { key: 'rssi', label: 'Tín hiệu' },
]

const FILTER_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'OFFLINE', label: 'Mất kết nối' },
  { value: 'PENDING', label: 'Chờ kết nối' },
  { value: 'WARNING', label: 'Cần xử lý' },
]

interface DeviceFilterToolbarProps {
  searchQuery: string
  setSearchQuery: (val: string) => void
  statusFilter: string
  setStatusFilter: (val: string) => void
  sortBy: DeviceSortKey
  sortDir: SortDirection
  onSortChange: (key: DeviceSortKey) => void
  hasActiveFilters: boolean
  onClear: () => void
}

export default function DeviceFilterToolbar({
  searchQuery, setSearchQuery, statusFilter, setStatusFilter, sortBy, sortDir, onSortChange, hasActiveFilters, onClear,
}: DeviceFilterToolbarProps) {
  return (
    <div className="flex w-full flex-col gap-3 mb-4">
      <SearchInput placeholder="Tìm mã thiết bị, firmware..." value={searchQuery} onChange={setSearchQuery} />
      <div className="flex flex-wrap items-center gap-3">
        <SelectMenu ariaLabel="Lọc theo trạng thái" value={statusFilter} options={FILTER_OPTIONS} onChange={setStatusFilter} />
        <SortChips fields={DEVICE_SORT_FIELDS} sortBy={sortBy} sortDir={sortDir} onChange={onSortChange} />
        {hasActiveFilters && <ClearFiltersButton onClick={onClear} />}
      </div>
    </div>
  )
}
