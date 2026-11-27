// Nhật ký hệ thống: lọc ở server, tìm và sắp ở client trên toàn bộ kết quả
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { USER_AUDIT_ACTIONS } from '@/constants/auditActions'
import { Button, SectionCard } from '@/components/ui'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import Pagination from '@/components/ui/Pagination'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { IconSearch } from '@/components/ui/icons'
import { getApiErrorMessage } from '@/lib/helpers'
import { AuditLogCard, buildAuditLogColumns } from '@/components/features/admin/audit-log/auditLogColumns'
import LoginFailedNotice from '@/components/features/admin/audit-log/LoginFailedNotice'
import AuditLogFilters from '@/components/features/admin/audit-log/AuditLogFilters'
import { useAuditLogTable } from '@/components/features/admin/audit-log/useAuditLogTable'

const PAGE_SIZE = 10
// px: vừa ô tên + vai trò và ô giờ + ngày 2 dòng; mọi dòng (kể cả dòng trống bù) cao bằng nhau
const ROW_HEIGHT = 60

export default function AdminAuditLogPage() {
  // ?action= và ?q= chỉ đọc làm giá trị khởi tạo; riêng q được ghi ngược lên URL để giữ khi reload/chia sẻ link.
  const [searchParams, setSearchParams] = useSearchParams()
  const table = useAuditLogTable(PAGE_SIZE, {
    action: (USER_AUDIT_ACTIONS as readonly string[]).find(a => a === searchParams.get('action')),
    search: searchParams.get('q') ?? '',
  })
  const { debouncedSearch } = table

  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (debouncedSearch.trim()) next.set('q', debouncedSearch.trim())
      else next.delete('q')
      return next
    }, { replace: true })
  }, [debouncedSearch, setSearchParams])

  return (
    // Tiêu đề trang do AppHeader (topbar) tự tra từ menu: không lặp lại trong nội dung
    <div className="flex min-w-0 flex-col gap-5">
      {/* Card danh sách duy nhất: tên trang đã ở header nên không có tiêu đề */}
      <SectionCard description="Đăng nhập, thay đổi tài khoản" className="min-w-0">
        {/* Có đăng nhập thất bại trong 7 ngày thì báo; bấm Xem để lọc đúng các dòng đó */}
        <LoginFailedNotice onShow={() => { table.setAction('LOGIN_FAILED'); table.setDatePreset('7d') }} />

        {/* Tìm kiếm và bộ lọc một hàng */}
        <AuditLogFilters table={table} />

        {table.isLoading && <div className="flex flex-col gap-2"><LoadingSkeleton count={PAGE_SIZE} className="h-[52px] w-full" /></div>}

        {/* Lỗi tải (500, mất mạng…) tách khỏi "chưa có nhật ký": kèm nút thử lại (FE_Design) */}
        {!table.isLoading && table.isError && (
          <EmptyState
            icon={<WarningCircleIcon size={28} />}
            title="Không tải được nhật ký"
            description={getApiErrorMessage(table.error, 'Kiểm tra kết nối tới máy chủ rồi thử lại.')}
            action={<Button variant="secondary" size="sm" onClick={() => table.refetch()}>Thử lại</Button>}
          />
        )}

        {!table.isLoading && !table.isError && table.visible.length === 0 && (
          <EmptyState
            icon={<IconSearch width={28} height={28} />}
            title={table.hasFilter ? 'Không tìm thấy nhật ký phù hợp' : 'Chưa có nhật ký nào'}
            description={table.hasFilter
              ? 'Thử từ khoá khác, đổi khoảng thời gian hoặc bỏ bớt bộ lọc.'
              : 'Đăng nhập, khoá/mở khoá, tạo hay xoá tài khoản... sẽ được ghi lại ở đây.'}
            action={table.hasFilter ? <Button variant="secondary" size="sm" onClick={table.clearFilters}>Xoá bộ lọc</Button> : undefined}
          />
        )}

        {!table.isLoading && !table.isError && table.visible.length > 0 && (
          // Trang ít hơn 10 dòng (trang cuối, kết quả lọc/tìm ít) vẫn giữ khung đủ 10 dòng: bảng không co lại
          <DataTable
            columns={buildAuditLogColumns()}
            rows={table.visible}
            getRowKey={log => log._id}
            // 1 trường duy nhất: bấm tiêu đề cột Thời gian chỉ đảo chiều mới nhất / cũ nhất
            sortKey="time"
            sortDirection={table.sortDir}
            onSortChange={table.toggleSort}
            rowHeight={ROW_HEIGHT}
            minRows={table.total > PAGE_SIZE ? PAGE_SIZE : 0}
            mobileCard={log => <AuditLogCard log={log} />}
          />
        )}

        {/* total = số nhật ký SAU khi tìm chữ: tìm ra 3 thì hiện "1–3 trong 3" */}
        <Pagination page={table.page} limit={PAGE_SIZE} total={table.total} onChange={table.setPage} variant="full" />
      </SectionCard>
    </div>
  )
}
