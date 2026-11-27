import { WarningIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui'
import { AUDIT_TARGET_TYPE } from '@/constants/auditActions'
import { useAuditLogList } from '@/hooks/admin/useSystem'
import { t } from '@/i18n'

// Nửa đêm (giờ máy người dùng) 6 ngày trước: 7 ngày tính cả hôm nay
function sevenDaysAgoIso() {
  const day = new Date()
  day.setDate(day.getDate() - 6)
  day.setHours(0, 0, 0, 0)
  return day.toISOString()
}

// Báo đăng nhập thất bại trong 7 ngày, bấm Xem để lọc; không đặt ngưỡng báo động vì chưa có nguồn, lỗi tải thì ẩn
export default function LoginFailedNotice({ onShow }: { onShow: () => void }) {
  const { total } = useAuditLogList({ action: 'LOGIN_FAILED', from: sevenDaysAgoIso(), targetType: AUDIT_TARGET_TYPE, page: 1, limit: 1 })
  if (!total) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-climateOrange/40 bg-climateOrange/[0.06] px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-medium text-charcoal">
        <WarningIcon size={18} weight="bold" aria-hidden className="shrink-0 text-climateOrange" />
        {t('{{n}} lần đăng nhập thất bại trong 7 ngày qua', { n: total })}
      </p>
      <Button type="button" size="sm" variant="secondary" onClick={onShow}>{t('Xem')}</Button>
    </div>
  )
}
