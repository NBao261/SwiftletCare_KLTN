// ADMIN — Quản lý tài khoản người dùng (AUTH-FR-005c/005d/011, RACI mục 4.4)
// Gọi API thật qua hooks/useUsers.ts (/admin/users, /admin/delete-requests...).
// Trang chính chỉ lo state/layout — cột bảng (columns.tsx), nhãn dùng chung
// (constants.ts) và từng modal (*Modal.tsx) nằm ở file riêng trong cùng thư mục.
import { useState } from 'react'
import { getUserStatus, useUsersList, type UsersSortKey } from '@/hooks/admin/useUsers'
import { Button, ClearFiltersButton, SearchInput, SortChips, SectionCard } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import Pagination from '@/components/ui/Pagination'
import DataTable from '@/components/ui/DataTable'
import SelectMenu from '@/components/ui/SelectMenu'
import { useAuthStore } from '@/stores/authStore'
import { STATUS_LABEL, FILTERABLE_STATUSES, ROLE_LABEL, SORT_FIELDS, type FilterableStatus } from '@/components/features/admin/users/users.constants'
import { buildUserColumns } from '@/components/features/admin/users/userColumns'
import UserDetailModal from '@/components/features/admin/users/UserDetailModal'
import LockUserModal from '@/components/features/admin/users/LockUserModal'
import UnlockUserModal from '@/components/features/admin/users/UnlockUserModal'
import UserStats from '@/components/features/admin/users/UserStats'
import CreateFarmOwnerModal from '@/components/features/admin/users/CreateFarmOwnerModal'
import type { Role, User, SortDirection } from '@/types'

const PAGE_SIZE = 10
/** px — vừa ô Ngày tạo 2 dòng (giờ/ngày); mọi dòng kể cả dòng trống bù cao bằng nhau → khung bảng cố định 10 dòng */
const ROW_HEIGHT = 64
const DEFAULT_SORT_BY: UsersSortKey = 'created_at'
const DEFAULT_SORT_DIR: SortDirection = 'desc'

// AD-03 — một danh sách mọi vai trò, lọc vai trò bằng ô chọn thay cho 2 tab
const ROLE_OPTIONS: Role[] = ['ADMIN', 'FARM_OWNER', 'FARM_TECHNICIAN', 'DOMAIN_EXPERT']

export default function AdminUsersPage() {
  const currentUserId = useAuthStore(s => s.user?._id)
  const [status, setStatus] = useState<FilterableStatus | undefined>(undefined)
  const [role, setRole] = useState<Role | ''>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<UsersSortKey>(DEFAULT_SORT_BY)
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR)
  const [viewTarget, setViewTarget] = useState<User | null>(null)
  const [lockTarget, setLockTarget] = useState<User | null>(null)
  const [unlockTarget, setUnlockTarget] = useState<User | null>(null)
  const [creatingOwner, setCreatingOwner] = useState(false)

  const { records, total, limit, isLoading } = useUsersList({
    status, role: role || undefined, search: search || undefined, sortBy, sortDir, page, limit: PAGE_SIZE,
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
    onLock: setLockTarget,
    onUnlock: setUnlockTarget,
  }, currentUserId)

  return (
    // Tiêu đề trang do AppHeader (topbar) tự tra từ menu — không lặp lại trong nội dung
    <div className="flex flex-col gap-5">
      {/* Hàng 0: 4 ô chỉ số (chỉ xem) — số liệu toàn hệ thống */}
      <UserStats />

      {/* Card một mình trên trang: tên trang đã ở header nên không có tiêu đề */}
      <SectionCard
        description="Mọi tài khoản trên hệ thống"
        help="Quản trị viên chỉ tạo tài khoản chủ nhà yến. Kỹ thuật viên và chuyên gia do chủ nhà yến mời vào trang trại."
      >
        {/* Hàng 1: tìm kiếm + nút chính duy nhất */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[200px] flex-1">
            <SearchInput
              placeholder="Tìm tên/email..."
              value={search}
              onChange={v => { setSearch(v); setPage(1) }}
            />
          </div>
          <Button type="button" onClick={() => setCreatingOwner(true)}>Tạo chủ nhà yến</Button>
        </div>

        {/* Hàng 2: bộ lọc + sắp xếp */}
        <div className="flex flex-wrap items-center gap-3">
          <SelectMenu
            ariaLabel="Lọc theo vai trò"
            value={role}
            onChange={v => { setRole(v); setPage(1) }}
            options={[{ value: '' as const, label: 'Tất cả vai trò' }, ...ROLE_OPTIONS.map(r => ({ value: r, label: ROLE_LABEL[r] }))]}
          />
          <SelectMenu
            ariaLabel="Lọc theo trạng thái"
            value={status ?? ''}
            onChange={v => { setStatus(v || undefined); setPage(1) }}
            options={[{ value: '' as const, label: 'Tất cả trạng thái' }, ...FILTERABLE_STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s] }))]}
          />
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
            // Cố định khung 10 dòng như bảng Trang trại/Thiết bị — ít tài khoản/trang cuối vẫn giữ chiều cao
            rowHeight={ROW_HEIGHT}
            minRows={total > limit ? PAGE_SIZE : 0}
            // Admin không có trang chi tiết người dùng riêng — bấm dòng mở popup chi tiết (UserDetailModal)
            onRowClick={setViewTarget}
            emptyMessage="Không tìm thấy tài khoản nào, thử đổi bộ lọc hoặc từ khoá tìm kiếm."
            mobileCard={user => (
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="truncate text-body font-semibold text-charcoal">{user.full_name}</p>
                  <p className="truncate text-small text-warmGray">{user.email}</p>
                  <p className="text-small text-warmGray">{ROLE_LABEL[user.role]} · {STATUS_LABEL[getUserStatus(user)]}</p>
                </div>
                {/* Menu ⋯ dùng chung với cột Thao tác (đã chặn bấm lan ra thẻ) */}
                {columns[columns.length - 1].render(user, 0)}
              </div>
            )}
          />
        )}

        <Pagination page={page} limit={limit} total={total} onChange={setPage} variant="full" />
      </SectionCard>

      <UserDetailModal user={viewTarget} onClose={() => setViewTarget(null)} />
      <LockUserModal user={lockTarget} onClose={() => setLockTarget(null)} />
      <UnlockUserModal user={unlockTarget} onClose={() => setUnlockTarget(null)} />
      <CreateFarmOwnerModal open={creatingOwner} onClose={() => setCreatingOwner(false)} />
    </div>
  )
}
