// ADMIN — Quản lý tài khoản người dùng (AUTH-FR-005c/005d/011, RACI mục 4.4)
// Gọi API thật qua hooks/useUsers.ts (/admin/users, /admin/delete-requests...).
// Trang chính chỉ lo state/layout — cột bảng (columns.tsx), nhãn dùng chung
// (constants.ts) và từng modal (*Modal.tsx) nằm ở file riêng trong cùng thư mục.
import { useState } from 'react'
import { useUsersList, type UsersSortKey } from '@/hooks/useUsers'
import { Button, Input } from '@/components/ui'
import { IconSortAsc, IconSortDesc, IconSearch } from '@/components/ui/icons'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import Pagination from '@/components/common/Pagination'
import FilterChip from '@/components/common/FilterChip'
import DataTable from '@/components/common/DataTable'
import SelectMenu from '@/components/common/SelectMenu'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/cn'
import { STATUS_LABEL, FILTERABLE_STATUSES, ROLE_LABEL, SORT_FIELDS, type FilterableStatus } from './constants'
import { buildUserColumns } from './columns'
import UserDetailModal from './UserDetailModal'
import EditUserModal from './EditUserModal'
import LockUserModal from './LockUserModal'
import UnlockUserModal from './UnlockUserModal'
import CreateUserModal from './CreateUserModal'
import type { Role, User, SortDirection } from '@/types'

const DEFAULT_SORT_BY: UsersSortKey = 'created_at'
const DEFAULT_SORT_DIR: SortDirection = 'desc'

export default function UsersPage() {
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

  function handleSortChange(key: string) {
    if (key === sortBy) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key as UsersSortKey)
      setSortDir('asc')
    }
  }

  const hasActiveFilters = status !== undefined || role !== '' || search !== ''
    || sortBy !== DEFAULT_SORT_BY || sortDir !== DEFAULT_SORT_DIR
  // /admin/users chưa có search/sort — 2 thao tác này chỉ chạy trên `records` của
  // trang hiện tại (hooks/useUsers.ts). Có nhiều hơn 1 trang thì phải nói rõ,
  // không thì Admin tưởng "không tìm thấy" nghĩa là tài khoản không tồn tại.
  const isPageScoped = (search !== '' || sortBy !== DEFAULT_SORT_BY || sortDir !== DEFAULT_SORT_DIR) && total > limit

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
    <div className="flex flex-col gap-5">
      <div>
        <p className="label-caption">Quản trị hệ thống</p>
        <h1 className="text-h1 tracking-tight text-charcoal">Người dùng</h1>
      </div>

      {/* Hàng 1: tìm kiếm + tạo tài khoản. 1 nút duy nhất — Admin chỉ tạo Technician/Sales
          Staff (AUTH-FR-005c), chọn vai trò ngay trong modal thay vì 2 nút riêng. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[200px] flex-1">
          <Input
            icon={<IconSearch width={16} height={16} />}
            placeholder="Tìm tên/email trong trang này..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
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
          options={[{ value: '', label: 'Mọi vai trò' }, ...(Object.keys(ROLE_LABEL) as Role[]).map(r => ({ value: r, label: ROLE_LABEL[r] }))]}
        />
        <div className="flex flex-nowrap gap-2">
          <FilterChip active={status === undefined} label="Tất cả" onClick={() => { setStatus(undefined); setPage(1) }} />
          {FILTERABLE_STATUSES.map(s => (
            <FilterChip key={s} active={status === s} label={STATUS_LABEL[s]} onClick={() => { setStatus(s); setPage(1) }} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="label-caption">Sắp xếp:</span>
          {SORT_FIELDS.map(f => {
            const active = sortBy === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => handleSortChange(f.key)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  active ? 'bg-charcoal text-white' : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20',
                )}
              >
                {f.label}
                {active && (sortDir === 'asc' ? <IconSortAsc width={12} height={12} /> : <IconSortDesc width={12} height={12} />)}
              </button>
            )
          })}
        </div>
        {hasActiveFilters && (
          <Button variant="danger" size="sm" className="h-8 px-3.5 text-xs" onClick={clearFilters}>Hủy lọc</Button>
        )}
      </div>

      {isPageScoped && (
        <p className="-mt-2 text-xs text-climateOrange">
          Tìm kiếm và sắp xếp chỉ áp dụng trong trang hiện tại ({records.length}/{total} tài khoản) — đổi bộ lọc vai trò/trạng thái hoặc lật trang để tìm tiếp.
        </p>
      )}

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
          emptyMessage={search && total > limit
            ? 'Không có tài khoản nào khớp trong trang này — thử lật sang trang khác hoặc đổi bộ lọc.'
            : 'Không tìm thấy tài khoản nào — thử đổi bộ lọc hoặc từ khoá tìm kiếm.'}
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
