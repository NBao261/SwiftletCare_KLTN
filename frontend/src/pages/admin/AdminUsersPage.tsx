// Quản lý tài khoản; trang chỉ lo state và layout
import { useMemo, useState } from 'react'
import { getUserStatus, useAllUsers, useUsersList, type UsersSortKey } from '@/hooks/admin/useUsers'
import { Button, ClearFiltersButton, SearchInput, SectionCard } from '@/components/ui'
import StatusTabs from '@/components/common/StatusTabs'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import LoadError from '@/components/ui/LoadError'
import Pagination from '@/components/ui/Pagination'
import DataTable from '@/components/ui/DataTable'
import SelectMenu from '@/components/ui/SelectMenu'
import { useAuthStore } from '@/stores/authStore'
import { STATUS_LABEL, FILTERABLE_STATUSES, ROLE_LABEL, type FilterableStatus } from '@/components/features/admin/users/users.constants'
import { buildUserColumns } from '@/components/features/admin/users/userColumns'
import UserDetailModal from '@/components/features/admin/users/UserDetailModal'
import LockUserModal from '@/components/features/admin/users/LockUserModal'
import UnlockUserModal from '@/components/features/admin/users/UnlockUserModal'
import CreateFarmOwnerModal from '@/components/features/admin/users/CreateFarmOwnerModal'
import { t } from '@/i18n'
import type { Role, User, SortDirection } from '@/types'

const PAGE_SIZE = 10
// px: vừa ô tên + email 2 dòng; mọi dòng kể cả dòng trống bù cao bằng nhau → khung bảng cố định 10 dòng
const ROW_HEIGHT = 64
const DEFAULT_SORT_BY: UsersSortKey = 'created_at'
const DEFAULT_SORT_DIR: SortDirection = 'desc'

// một danh sách mọi vai trò, chọn vai trò bằng hàng tab
const ROLE_OPTIONS: Role[] = ['FARM_OWNER', 'FARM_TECHNICIAN', 'DOMAIN_EXPERT', 'ADMIN']

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

  const { records, total, limit, isLoading, isError, error, refetch } = useUsersList({
    status, role: role || undefined, search: search || undefined, sortBy, sortDir, page, limit: PAGE_SIZE,
  })

  // Số trên tab: đếm ở client vì backend không có endpoint thống kê, theo cùng bộ lọc trạng thái với bảng
  // (không theo ô tìm kiếm); chưa tải xong thì tab không ghi số
  const { data: allUsers } = useAllUsers()
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 }
    for (const user of allUsers ?? []) {
      if (status && getUserStatus(user) !== status) continue
      counts.ALL += 1
      counts[user.role] = (counts[user.role] ?? 0) + 1
    }
    return counts
  }, [allUsers, status])
  const withCount = (label: string, key: string) => (allUsers ? `${label} (${roleCounts[key] ?? 0})` : label)

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

  const hasActiveFilters = status !== undefined || search !== ''

  function clearFilters() {
    setStatus(undefined)
    setSearch('')
    setPage(1)
  }

  const columns = buildUserColumns({
    onView: setViewTarget,
    onLock: setLockTarget,
    onUnlock: setUnlockTarget,
  }, currentUserId)

  return (
    // Tiêu đề trang do AppHeader (topbar) tự tra từ menu: không lặp lại trong nội dung
    <div className="flex flex-col gap-5">
      {/* Card một mình trên trang: tên trang đã ở header nên không có tiêu đề; nút chính duy nhất ở góc phải */}
      <SectionCard
        description="Mọi tài khoản trên hệ thống"
        help="Quản trị viên chỉ tạo tài khoản chủ nhà yến. Kỹ thuật viên và chuyên gia do chủ nhà yến mời vào trang trại."
        action={<Button type="button" onClick={() => setCreatingOwner(true)}>Tạo chủ nhà yến</Button>}
      >
        <StatusTabs
          variant="underline"
          ariaLabel={t('Lọc tài khoản theo vai trò')}
          value={role || 'ALL'}
          onChange={id => { setRole(id === 'ALL' ? '' : id); setPage(1) }}
          tabs={[
            { id: 'ALL', label: withCount(t('Tất cả'), 'ALL') },
            ...ROLE_OPTIONS.map(r => ({ id: r, label: withCount(ROLE_LABEL[r], r) })),
          ]}
        />

        {/* Tìm kiếm và lọc trạng thái; sắp xếp bấm ở tiêu đề cột */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[14rem] flex-1 sm:max-w-sm">
            <SearchInput
              placeholder="Tìm tên/email..."
              value={search}
              onChange={v => { setSearch(v); setPage(1) }}
            />
          </div>
          <SelectMenu
            ariaLabel="Lọc theo trạng thái"
            value={status ?? ''}
            onChange={v => { setStatus(v || undefined); setPage(1) }}
            options={[{ value: '' as const, label: 'Tất cả trạng thái' }, ...FILTERABLE_STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s] }))]}
          />
          {hasActiveFilters && (
            <ClearFiltersButton onClick={clearFilters} />
          )}
        </div>

        {isLoading ? (
          <LoadingSkeleton count={4} className="h-14 w-full" />
        ) : isError ? (
          <LoadError title={t('Không tải được danh sách tài khoản')} error={error} onRetry={() => void refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={records}
            getRowKey={(u) => u._id}
            sortKey={sortBy}
            sortDirection={sortDir}
            onSortChange={handleSortChange}
            // Cố định khung 10 dòng như bảng Trang trại/Thiết bị: ít tài khoản/trang cuối vẫn giữ chiều cao
            rowHeight={ROW_HEIGHT}
            minRows={total > limit ? PAGE_SIZE : 0}
            // Admin không có trang chi tiết người dùng riêng: bấm dòng mở popup chi tiết (UserDetailModal)
            onRowClick={setViewTarget}
            emptyMessage="Không tìm thấy tài khoản nào. Thử đổi bộ lọc hoặc từ khoá tìm kiếm."
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
