// ADMIN — Tổng quan hệ thống (SYSTEM-FR-003), thay thế /system-status cũ. Bố cục theo mẫu "Tổng quan nền tảng":
// 1) hàng 3 ô KPI · 2) nhật ký hoạt động gần đây (RecentActivityCard). Số liệu thật: health-overview, /alerts,
// /system/audit-logs. Không phải BI đầy đủ (SYSTEM-FR-003).
// Tiêu đề trang lấy từ menu (AppHeader tự tra), không lặp lại trong nội dung.
import { CpuIcon, HouseIcon, WarningIcon } from '@phosphor-icons/react'
import { useSystemHealth } from '@/hooks/admin/useSystem'
import { useAlertsList } from '@/hooks/shared/useAlerts'
import { Card } from '@/components/ui'
import StatTile from '@/components/ui/StatTile'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import RecentActivityCard from '@/components/features/admin/dashboard/RecentActivityCard'
import { getApiErrorMessage } from '@/lib/helpers'
import { t as i18nT } from '@/i18n'

/** Màu vòng icon theo ReadingTile (Dashboard Farm Owner): xám nhạt, không đổi đỏ theo trạng thái */
const ICON_NORMAL = 'bg-warmGray/10 text-charcoal'

export default function AdminSystemHealthPage() {
  const { data, isLoading, error } = useSystemHealth()
  const criticalAlerts = useAlertsList({ status: 'ACTIVE', severity: 'CRITICAL', page: 1, limit: 1 })

  if (isLoading) return <LoadingSkeleton count={4} className="h-28 w-full" />
  if (error || !data) {
    return (
      <EmptyState
        icon={<WarningIcon size={28} />}
        title="Không tải được số liệu hệ thống"
        description={getApiErrorMessage(error, 'Thử tải lại trang.')}
      />
    )
  }

  const { farms, zones, devices } = data
  const hasDevices = devices.total > 0
  // Liệt kê mọi trạng thái khác ONLINE đang có (bỏ số 0) — trước đây có lỗi thì ẩn mất offline/chờ kết nối
  const deviceIssues = ([
    [devices.error, 'lỗi'],
    [devices.degraded, 'suy giảm'],
    [devices.offline, 'offline'],
    [devices.pending, 'chờ kết nối'],
  ] as const).filter(([n]) => n > 0).map(([n, label]) => `${n} ${i18nT(label)}`)
  const deviceSub = !hasDevices
    ? 'Chưa có thiết bị'
    : deviceIssues.length ? deviceIssues.join(' · ') : 'Tất cả đang online'

  return (
    <div className="flex flex-col gap-5">
      {/* ── Hàng 3 ô KPI — bọc Card giống EnvSensorPanel ở Dashboard Farm Owner; ô nằm trong khung
          nên bỏ shadow riêng (shadow-none), như ReadingTile ── */}
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-h2 text-charcoal">{i18nT('Chỉ số vận hành toàn hệ thống')}</h2>
          <p className="mt-1 text-sm text-warmGray">{i18nT('Trang trại, thiết bị và cảnh báo khẩn cấp trên mọi Farm')}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatTile
            className="shadow-none"
            icon={HouseIcon}
            iconClass={ICON_NORMAL}
            label="Trang trại hoạt động"
            value={farms.total}
            sub={i18nT('Gồm {{n}} phòng', { n: zones.total })}
          />
          <StatTile
            className="shadow-none"
            icon={CpuIcon}
            iconClass={ICON_NORMAL}
            label="Thiết bị online"
            // Số thiết bị online / tổng thiết bị đang phục vụ (thay cho % — 0% với 2 thiết bị khó hình dung)
            value={hasDevices ? `${devices.online}/${devices.total}` : '--'}            sub={deviceSub}
          />
          <StatTile
            className="shadow-none"
            icon={WarningIcon}
            iconClass={ICON_NORMAL}
            // Query chỉ lấy status ACTIVE — không ghi "đang mở" vì ACKNOWLEDGED cũng là đang mở (ALERT-FR-008/009).
            // Admin không xác nhận cảnh báo (chỉ Farm Owner, ALERT-FR-009) → dòng phụ nói ai chưa phản hồi, tránh
            // chữ "chờ xác nhận" khiến Admin tưởng việc đó của mình
            label="Cảnh báo CRITICAL"
            value={String(criticalAlerts.total)}
            sub={criticalAlerts.total > 0 ? 'Farm Owner chưa phản hồi' : 'Không có cảnh báo mới'}
          />
        </div>
      </Card>

      <RecentActivityCard />
    </div>
  )
}
