// ADMIN — Quản lý tài khoản người dùng (AUTH-FR-005c/005d/011, RACI mục 4.4)
// Gọi API thật qua hooks/useUsers.ts (/admin/users, /admin/delete-requests...).
// Trang chính chỉ lo state/layout — cột bảng (columns.tsx), nhãn dùng chung
// (constants.ts) và từng modal (*Modal.tsx) nằm ở file riêng trong cùng thư mục.
import { useState } from 'react'
import { useUsersList, type UsersSortKey } from '@/hooks/admin/useUsers'
import { Button, ClearFiltersButton, SearchInput, SortChips } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import Pagination from '@/components/ui/Pagination'
import FilterChip from '@/components/ui/FilterChip'
import DataTable from '@/components/ui/DataTable'
import SelectMenu from '@/components/ui/SelectMenu'
import { useAuthStore } from '@/stores/authStore'
import { STATUS_LABEL, FILTERABLE_STATUSES, ROLE_LABEL, SORT_FIELDS, type FilterableStatus } from '@/components/features/admin/users/users.constants'
import { buildUserColumns } from '@/components/features/admin/users/userColumns'
import UserDetailModal from '@/components/features/admin/users/UserDetailModal'
import EditUserModal from '@/components/features/admin/users/EditUserModal'
import LockUserModal from '@/components/features/admin/users/LockUserModal'
import UnlockUserModal from '@/components/features/admin/users/UnlockUserModal'
import CreateUserModal from '@/components/features/admin/users/CreateUserModal'
import UserStats from '@/components/features/admin/users/UserStats'
import type { Role, User, SortDirection } from '@/types'

const DEFAULT_SORT_BY: UsersSortKey = 'created_at'
const DEFAULT_SORT_DIR: SortDirection = 'desc'

export default function AdminUsersPage() {
  const currentUserId = useAuthStore(s => s.user?._id)
  const [status, setStatus] = useState<FilterableStatus | undefined>(undefined)
  const [role, setRole] = useState<Role | ''>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<UsersSortKey>(DEFAULT_SORT_BY)
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR)
  const [showCreate, setShowCreate] = useState(false)
  const [viewTarget, setViewTarget] = useState<User | null>(null)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [lockTarget, setLockTarget] = useState<User | null>(null)
  const [unlockTarget, setUnlockTarget] = useState<User | null>(null)

  const { records, total, limit, isLoading } = useUsersList({
    status, role: role || undefined, search: search || undefined, sortBy, sortDir, page, limit: 10,
  })

  // Sắp trên toàn bộ tài khoản → đổi tiêu chí thì về trang 1
  function handleSortChange(key: string) {
    if (key === sortBy) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key as UsersSortKey)
      setSortDir('asc')
    }
    setPage(1)
  }

  const hasActiveFilters = status !== undefined || role !== '' || search !== ''
    || sortBy !== DEFAULT_SORT_BY || sortDir !== DEFAULT_SORT_DIR

  function clearFilters() {
    setStatus(undefined)
    setRole('')
    setSearch('')
    setSortBy(DEFAULT_SORT_BY)
    setSortDir(DEFAULT_SORT_DIR)
    setPage(1)
  }

  const columns = buildUserColumns({
    onView: setViewTarget,
    onEditRegions: setEditTarget,
    onLock: setLockTarget,
    onUnlock: setUnlockTarget,
  }, (page - 1) * limit, currentUserId)

  return (
    // Tiêu đề trang do AppHeader (topbar) tự tra từ menu — không lặp lại trong nội dung
    <div className="flex flex-col gap-5">
      {/* Hàng 0: 5 ô chỉ số (chỉ xem) — số liệu toàn hệ thống, cùng khuôn trang Ticket */}
      <UserStats />

      {/* Hàng 1: tìm kiếm + tạo tài khoản. 1 nút duy nhất — Admin chỉ tạo Technician/Sales
          Staff (AUTH-FR-005c), chọn vai trò ngay trong modal thay vì 2 nút riêng. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <SearchInput
            placeholder="Tìm tên/email..."
            value={search}
            onChange={v => { setSearch(v); setPage(1) }}
          />
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Tạo tài khoản</Button>
      </div>

      {/* Hàng 2: toàn bộ bộ lọc + sắp xếp */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Mọi control trên hàng này cao bằng nút sắp xếp (h-8, text-xs) cho thẳng hàng */}
        <SelectMenu
          ariaLabel="Lọc theo vai trò"
          value={role}
          onChange={v => { setRole(v); setPage(1) }}
          options={[{ value: '', label: 'Tất cả vai trò' }, ...(Object.keys(ROLE_LABEL) as Role[]).map(r => ({ value: r, label: ROLE_LABEL[r] }))]}
        />
        <div className="flex flex-nowrap gap-2">
          <FilterChip active={status === undefined} label="Tất cả" onClick={() => { setStatus(undefined); setPage(1) }} />
          {FILTERABLE_STATUSES.map(s => (
            <FilterChip key={s} active={status === s} label={STATUS_LABEL[s]} onClick={() => { setStatus(s); setPage(1) }} />
          ))}
        </div>
        <SortChips fields={SORT_FIELDS} sortBy={sortBy} sortDir={sortDir} onChange={handleSortChange} />
        {hasActiveFilters && (
          <ClearFiltersButton onClick={clearFilters} />
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton count={4} className="h-14 w-full" />
      ) : (
        <DataTable
          columns={columns}
          rows={records}
          getRowKey={(u) => u._id}
          sortKey={sortBy}
          sortDirection={sortDir}
          onSortChange={handleSortChange}
          emptyMessage="Không tìm thấy tài khoản nào — thử đổi bộ lọc hoặc từ khoá tìm kiếm."
        />
      )}

      <Pagination page={page} limit={limit} total={total} onChange={setPage} />

      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} />
      <UserDetailModal user={viewTarget} onClose={() => setViewTarget(null)} />
      <EditUserModal user={editTarget} onClose={() => setEditTarget(null)} />
      <LockUserModal user={lockTarget} onClose={() => setLockTarget(null)} />
      <UnlockUserModal user={unlockTarget} onClose={() => setUnlockTarget(null)} />
    </div>
  )
}
