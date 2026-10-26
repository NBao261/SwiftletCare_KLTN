// ADMIN — Quản lý tài khoản người dùng (AUTH-FR-005c/005d/011, RACI mục 4.4)
// Gọi API thật qua hooks/useUsers.ts (/admin/users, /admin/delete-requests...).
// Trang chính chỉ lo state/layout — cột bảng (columns.tsx), nhãn dùng chung
// (constants.ts) và từng modal (*Modal.tsx) nằm ở file riêng trong cùng thư mục.
import { useState } from 'react'
import { useUsersList, type UsersSortKey } from '@/hooks/admin/useUsers'
import { Button, ClearFiltersButton, SearchInput, SortChips, SectionCard } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import Pagination from '@/components/ui/Pagination'
import DataTable from '@/components/ui/DataTable'
import SelectMenu from '@/components/ui/SelectMenu'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/cn'
import { tr } from '@/i18n'
import { STATUS_LABEL, FILTERABLE_STATUSES, ROLE_LABEL, SORT_FIELDS, type FilterableStatus } from '@/components/features/admin/users/users.constants'
import { buildUserColumns } from '@/components/features/admin/users/userColumns'
import UserDetailModal from '@/components/features/admin/users/UserDetailModal'
import LockUserModal from '@/components/features/admin/users/LockUserModal'
import UnlockUserModal from '@/components/features/admin/users/UnlockUserModal'
import CreateUserModal from '@/components/features/admin/users/CreateUserModal'
import UserStats from '@/components/features/admin/users/UserStats'
import type { Role, User, SortDirection } from '@/types'

const PAGE_SIZE = 10
/** px — vừa ô Ngày tạo 2 dòng (giờ/ngày); mọi dòng kể cả dòng trống bù cao bằng nhau → khung bảng cố định 10 dòng */
const ROW_HEIGHT = 64
const DEFAULT_SORT_BY: UsersSortKey = 'created_at'
const DEFAULT_SORT_DIR: SortDirection = 'desc'

/**
 * 2 tab tách nhân viên vận hành hệ thống (Quản trị viên, Kỹ thuật viên) khỏi người dùng phía khách hàng (Chủ nhà yến +
 * Chuyên gia). `roles` = nhóm vai trò của tab, lọc ở client vì backend
 * /admin/users chỉ nhận 1 role.
 */
type UserTab = 'staff' | 'customers'
const TABS: { key: UserTab; label: string; description: string; roles: Role[] }[] = [
  { key: 'staff', label: 'Nhân viên hệ thống', description: 'Quản trị viên và kỹ thuật viên', roles: ['ADMIN', 'TECHNICIAN'] },
  { key: 'customers', label: 'Người dùng', description: 'Chủ nhà yến và chuyên gia', roles: ['FARM_OWNER', 'DOMAIN_EXPERT'] },
]

export default function AdminUsersPage() {
  const currentUserId = useAuthStore(s => s.user?._id)
  const [tab, setTab] = useState<UserTab>('staff')
  const currentTab = TABS.find(x => x.key === tab)!
  const [status, setStatus] = useState<FilterableStatus | undefined>(undefined)
  const [role, setRole] = useState<Role | ''>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<UsersSortKey>(DEFAULT_SORT_BY)
  const [sortDir, setSortDir] = useState<SortDirection>(DEFAULT_SORT_DIR)
  const [showCreate, setShowCreate] = useState(false)
  const [viewTarget, setViewTarget] = useState<User | null>(null)
  const [lockTarget, setLockTarget] = useState<User | null>(null)
  const [unlockTarget, setUnlockTarget] = useState<User | null>(null)

  const { records, total, limit, isLoading } = useUsersList({
    // Lọc vai trò ở client (cùng cách lọc nhóm vai trò của tab)
    status, roles: role ? [role] : currentTab.roles, search: search || undefined, sortBy, sortDir, page, limit: PAGE_SIZE,
  })

  // Đổi tab → bỏ lọc vai trò của tab cũ (không còn trong tab mới) và về trang 1
  function changeTab(next: UserTab) {
    setTab(next)
    setRole('')
    setPage(1)
  }

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
  }, (page - 1) * limit, currentUserId)

  return (
    // Tiêu đề trang do AppHeader (topbar) tự tra từ menu — không lặp lại trong nội dung
    <div className="flex flex-col gap-5">
      {/* Hàng 0: 5 ô chỉ số (chỉ xem) — số liệu toàn hệ thống */}
      <UserStats />

      {/* Card danh sách (SectionCard): tìm kiếm → bộ lọc → bảng → phân trang — icon như mục menu sidebar */}
      <SectionCard
        title={currentTab.label}
        description={currentTab.description}
        // Tab pill
        action={
          <div className="inline-flex gap-1 rounded-full bg-warmGray/10 p-1" role="tablist" aria-label={tr('Nhóm tài khoản')}>
            {TABS.map(x => (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={tab === x.key}
                onClick={() => changeTab(x.key)}
                className={cn(
                  'h-9 whitespace-nowrap rounded-full px-4 text-small font-semibold transition-colors duration-150',
                  tab === x.key ? 'bg-white text-charcoal shadow-card' : 'text-warmGray hover:text-charcoal',
                )}
              >
                {tr(x.label)}
              </button>
            ))}
          </div>
        }
      >

        {/* Hàng 1: tìm kiếm + tạo tài khoản. Nút tạo chỉ ở tab Nhân viên — Admin chỉ tạo Technician/chuyên gia
            (AUTH-FR-005c), Farm Owner tự đăng ký. Chọn vai trò ngay trong modal thay vì 2 nút riêng. */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[200px] flex-1">
            <SearchInput
              placeholder="Tìm tên/email..."
              value={search}
              onChange={v => { setSearch(v); setPage(1) }}
            />
          </div>
          {tab === 'staff' && <Button onClick={() => setShowCreate(true)}>+ Tạo tài khoản</Button>}
        </div>

        {/* Hàng 2: toàn bộ bộ lọc + sắp xếp */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Mọi control trên hàng này cao bằng nút sắp xếp (h-8, text-xs) cho thẳng hàng. Lọc vai trò chỉ ở tab
              Nhân viên (tab Người dùng chỉ có 1 vai trò) */}
          {currentTab.roles.length > 1 && (
            <SelectMenu
              ariaLabel="Lọc theo vai trò"
              value={role}
              onChange={v => { setRole(v); setPage(1) }}
              options={[{ value: '', label: 'Tất cả vai trò' }, ...currentTab.roles.map(r => ({ value: r, label: ROLE_LABEL[r] }))]}
            />
          )}
          {/* Trạng thái gộp 1 ô chọn (như trang Trang trại) thay cho 3 chip rời */}
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
            minRows={PAGE_SIZE}
            // Admin không có trang chi tiết người dùng riêng — bấm dòng mở popup chi tiết (UserDetailModal)
            onRowClick={setViewTarget}
            emptyMessage="Không tìm thấy tài khoản nào — thử đổi bộ lọc hoặc từ khoá tìm kiếm."
          />
        )}

        <Pagination page={page} limit={limit} total={total} onChange={setPage} variant="full" />
      </SectionCard>

      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} />
      <UserDetailModal user={viewTarget} onClose={() => setViewTarget(null)} />
      <LockUserModal user={lockTarget} onClose={() => setLockTarget(null)} />
      <UnlockUserModal user={unlockTarget} onClose={() => setUnlockTarget(null)} />
    </div>
  )
}
