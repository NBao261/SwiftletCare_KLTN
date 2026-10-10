// ADMIN — Nhật ký hệ thống (SYSTEM-FR-001): GET /system/audit-logs, lọc theo
// người thực hiện / hành động / khoảng ngày (server) + ô tìm kiếm & sắp xếp (client, trên
// TOÀN BỘ nhật ký khớp bộ lọc). Hiển thị 1 bảng DataTable như trang Người dùng.
// Chỉ nhật ký TÀI KHOẢN (target_type='user', lọc server) — không hiện log thiết bị/ticket/cấu hình.
// Logic lọc/sắp xếp dùng chung với card "Nhật ký hoạt động gần đây" (useAuditLogTable + AuditLogFilters).
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { USER_AUDIT_ACTIONS } from '@/constants/auditActions'
import { Button, SearchInput, SectionCard } from '@/components/ui'
import DataTable from '@/components/ui/DataTable'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import Pagination from '@/components/ui/Pagination'
import { IconSearch } from '@/components/ui/icons'
import { buildAuditLogColumns } from '@/components/features/admin/audit-log/auditLogColumns'
import AuditLogStats from '@/components/features/admin/audit-log/AuditLogStats'
import AuditLogFilters from '@/components/features/admin/audit-log/AuditLogFilters'
import { useAuditLogTable } from '@/components/features/admin/audit-log/useAuditLogTable'

const PAGE_SIZE = 10
/** px — mọi dòng (kể cả dòng trống bù) cao bằng nhau, cùng chiều cao card "Nhật ký hoạt động gần đây" */
const ROW_HEIGHT = 52

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
    // Tiêu đề trang do AppHeader (topbar) tự tra từ menu — không lặp lại trong nội dung
    <div className="flex min-w-0 flex-col gap-5">
      {/* Hàng 0: 5 ô chỉ số (chỉ xem) — số liệu toàn hệ thống, cùng khuôn trang Ticket/Người dùng */}
      <AuditLogStats />

      {/* Card danh sách (SectionCard): tìm kiếm → bộ lọc → bảng → phân trang */}
      <SectionCard title="Danh sách nhật ký" description="Ai đăng nhập, khoá, tạo hay xoá tài khoản nào và khi nào" className="min-w-0">

        {/* Hàng 1: ô tìm kiếm cỡ mặc định, rộng hết hàng — cùng bố cục trang Người dùng */}
        <SearchInput
          placeholder="Tìm theo hành động, tên tài khoản..."
          aria-label="Tìm nhật ký"
          value={table.search}
          // Tìm trên toàn bộ nhật ký → gõ từ khoá thì về trang 1
          onChange={table.setSearch}
        />

        {/* Hàng 2: bộ lọc + sắp xếp */}
        <AuditLogFilters table={table} />

        {table.isLoading && <div className="flex flex-col gap-2"><LoadingSkeleton count={PAGE_SIZE} className="h-[52px] w-full" /></div>}

        {!table.isLoading && table.visible.length === 0 && (
          <EmptyState
            icon={<IconSearch width={28} height={28} />}
            title={table.hasFilter ? 'Không tìm thấy nhật ký phù hợp' : 'Chưa có nhật ký nào'}
            description={table.hasFilter
              ? 'Thử từ khoá khác, đổi khoảng thời gian hoặc bỏ bớt bộ lọc.'
              : 'Đăng nhập, khoá/mở khoá, tạo hay xoá tài khoản... sẽ được ghi lại ở đây.'}
            action={table.hasFilter ? <Button variant="secondary" size="sm" onClick={table.clearFilters}>Xoá bộ lọc</Button> : undefined}
          />
        )}

        {!table.isLoading && table.visible.length > 0 && (
          // Trang ít hơn 10 dòng (trang cuối, kết quả lọc/tìm ít) vẫn giữ khung đủ 10 dòng — bảng không co lại
          <DataTable
            columns={buildAuditLogColumns((table.page - 1) * PAGE_SIZE)}
            rows={table.visible}
            getRowKey={log => log._id}
            rowHeight={ROW_HEIGHT}
            minRows={PAGE_SIZE}
          />
        )}

        {/* total = số nhật ký SAU khi tìm chữ — tìm ra 3 thì hiện "1–3 trong 3" */}
        <Pagination page={table.page} limit={PAGE_SIZE} total={table.total} onChange={table.setPage} variant="full" />
      </SectionCard>
    </div>
  )
}
