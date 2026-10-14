import { Link } from 'react-router-dom'
import { ArrowRightIcon } from '@phosphor-icons/react'
import DataTable from '@/components/ui/DataTable'
import Pagination from '@/components/ui/Pagination'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import SectionCard from '@/components/ui/SectionCard'
import { buildAuditLogColumns } from '@/components/features/admin/audit-log/auditLogColumns'
import AuditLogFilters from '@/components/features/admin/audit-log/AuditLogFilters'
import { useAuditLogTable } from '@/components/features/admin/audit-log/useAuditLogTable'
import { t } from '@/i18n'

const PAGE_SIZE = 6
/** px — mọi dòng (kể cả dòng trống bù) cao bằng nhau, để khung 6 dòng cố định */
const ROW_HEIGHT = 52

/**
 * "Nhật ký hoạt động gần đây" cuối trang Tổng quan hệ thống — 6 bản ghi/trang của GET /system/audit-logs
 * (SYSTEM-FR-001), dùng lại cột bảng + bộ lọc/sắp xếp của trang Nhật ký hệ thống (không có ô tìm chữ — có ở
 * /system/audit-log). Chỉ nhật ký tài khoản (lọc server theo target_type).
 */
export default function RecentActivityCard() {
  const table = useAuditLogTable(PAGE_SIZE)

  return (
    <SectionCard
      title="Nhật ký hoạt động gần đây"
      description="Đăng nhập và thay đổi tài khoản mới nhất"
      action={
        <Link to="/system/audit-log" className="group inline-flex items-center gap-1 text-small font-semibold text-charcoal hover:underline">
          {t('Xem tất cả')}
          <ArrowRightIcon size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      }
    >
      <AuditLogFilters table={table} />
      {table.isLoading ? (
        <LoadingSkeleton count={PAGE_SIZE} className="h-[52px] w-full" />
      ) : (
        <DataTable
          columns={buildAuditLogColumns((table.page - 1) * PAGE_SIZE)}
          rows={table.visible}
          getRowKey={log => log._id}
          emptyMessage={table.hasFilter ? 'Không có nhật ký khớp bộ lọc.' : 'Chưa có nhật ký nào.'}
          // Trang cuối ít hơn 6 dòng vẫn giữ khung đủ 6 dòng — card không co lại khi chuyển trang/lọc
          rowHeight={ROW_HEIGHT}
          minRows={PAGE_SIZE}
        />
      )}
      <Pagination page={table.page} limit={PAGE_SIZE} total={table.total} onChange={table.setPage} variant="full" />
    </SectionCard>
  )
}
