import { Link } from 'react-router-dom'
import { ArrowRightIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import SectionCard from '@/components/ui/SectionCard'
import { reasonOf } from '@/components/features/admin/audit-log/auditLogColumns'
import { AUDIT_ACTION_LABEL, AUDIT_TARGET_TYPE } from '@/constants/auditActions'
import { ROLE_LABEL } from '@/constants/roles'
import { useAuditLogList } from '@/hooks/admin/useSystem'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { formatRelativeTime } from '@/lib/helpers'
import { t } from '@/i18n'

const RECENT_COUNT = 5

// 5 nhật ký tài khoản mới nhất ở Tổng quan hệ thống, mỗi dòng: hành động, người thực hiện, lý do, thời điểm; lọc, tìm, phân trang ở /system/audit-log
export default function RecentActivityCard() {
  const { records, isLoading, isError, error, refetch } = useAuditLogList({ targetType: AUDIT_TARGET_TYPE, page: 1, limit: RECENT_COUNT })
  const apiErrorMessage = useApiErrorMessage()

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
      ) : records.length === 0 ? (
        <p className="py-6 text-center text-sm text-warmGray">{t('Chưa có nhật ký nào.')}</p>
      ) : (
        <ul className="-my-2 divide-y divide-warmGray/10">
          {records.map(log => {
            const label = AUDIT_ACTION_LABEL[log.action] ?? log.action
            // Không có người thực hiện thì dùng target_name, không bao giờ hiện ObjectId
            const who = log.actor_id?.full_name ?? log.target_name ?? t('Không xác định')
            const detail = [who, log.actor_id ? ROLE_LABEL[log.actor_id.role] : undefined, reasonOf(log)].filter(Boolean).join(' · ')
            return (
              <li key={log._id} className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-charcoal" title={label}>{label}</span>
                  <span className="block truncate text-small text-warmGray" title={detail}>{detail}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-small text-warmGray">{formatRelativeTime(log.created_at)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
