import { Link } from 'react-router-dom'
import { ArrowRightIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import DataTable from '@/components/ui/DataTable'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import SectionCard from '@/components/ui/SectionCard'
import { AuditLogCard, buildAuditLogColumns } from '@/components/features/admin/audit-log/auditLogColumns'
import { AUDIT_TARGET_TYPE } from '@/constants/auditActions'
import { useAuditLogList } from '@/hooks/admin/useSystem'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { t } from '@/i18n'

const RECENT_COUNT = 5

// 5 nhật ký tài khoản mới nhất ở Tổng quan hệ thống; lọc, tìm, phân trang ở /system/audit-log
export default function RecentActivityCard() {
  const { records, isLoading, isError, error, refetch } = useAuditLogList({ targetType: AUDIT_TARGET_TYPE, page: 1, limit: RECENT_COUNT })
  const apiErrorMessage = useApiErrorMessage()
  // Thứ tự đã là mới nhất trước, không cần cột STT
  const columns = buildAuditLogColumns(0).filter(column => column.key !== 'stt')

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
      {isLoading ? (
        <LoadingSkeleton count={RECENT_COUNT} className="h-[52px] w-full" />
      ) : isError ? (
        <EmptyState
          icon={<WarningCircleIcon size={28} />}
          title="Không tải được nhật ký"
          description={apiErrorMessage(error)}
          action={<Button variant="secondary" size="sm" onClick={() => refetch()}>Thử lại</Button>}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={records}
          getRowKey={log => log._id}
          emptyMessage="Chưa có nhật ký nào."
          mobileCard={log => <AuditLogCard log={log} />}
        />
      )}
    </SectionCard>
  )
}
