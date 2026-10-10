// ADMIN — Tổng quan hệ thống (SYSTEM-FR-003), thay thế /system-status cũ. Bố cục theo mẫu "Tổng quan nền tảng":
// 1) hàng 4 ô KPI · 2) card xu hướng ticket & tuân thủ SLA 7 ngày (TicketTrendChart, 2 tab) · 3) nhật ký hoạt động gần
// đây (RecentActivityCard). Mọi số liệu là dữ liệu thật: health-overview, /tickets (đếm ở client), /tickets/kpi,
// /alerts, /system/audit-logs — không có số minh hoạ. Không phải BI đầy đủ (SYSTEM-FR-003).
// Tiêu đề trang lấy từ menu (AppHeader tự tra), không lặp lại trong nội dung.
import { CpuIcon, HouseIcon, TicketIcon, WarningIcon } from '@phosphor-icons/react'
import { useSystemHealth } from '@/hooks/admin/useSystem'
import { useAllTickets } from '@/hooks/admin/useAdminTickets'
import { useAlertsList } from '@/hooks/shared/useAlerts'
import { Card } from '@/components/ui'
import StatTile from '@/components/ui/StatTile'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import TicketTrendChart from '@/components/features/admin/dashboard/TicketTrendChart'
import RecentActivityCard from '@/components/features/admin/dashboard/RecentActivityCard'
import { getApiErrorMessage } from '@/lib/helpers'

/** Khoá ngày theo giờ VN — để đếm "mới hôm nay" */
const DAY_KEY = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })

/** Màu vòng icon theo ReadingTile (Dashboard Farm Owner): xám nhạt, không đổi đỏ theo trạng thái */
const ICON_NORMAL = 'bg-warmGray/10 text-charcoal'

export default function AdminSystemHealthPage() {
  const { data, isLoading, error } = useSystemHealth()
  // Cùng cache với bảng Ticket của Admin và biểu đồ xu hướng bên dưới — không tải thêm lần nữa
  const { data: tickets } = useAllTickets({})
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

  const { farms, zones, devices, openTickets } = data
  const hasDevices = devices.total > 0
  // Liệt kê mọi trạng thái khác ONLINE đang có (bỏ số 0) — trước đây có lỗi thì ẩn mất offline/chờ kết nối
  const deviceIssues = ([
    [devices.error, 'lỗi'],
    [devices.degraded, 'suy giảm'],
    [devices.offline, 'offline'],
    [devices.pending, 'chờ kết nối'],
  ] as const).filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`)
  const deviceSub = !hasDevices
    ? 'Chưa có thiết bị'
    : deviceIssues.length ? deviceIssues.join(' · ') : 'Tất cả đang online'

  const today = DAY_KEY.format(new Date())
  const open = (tickets ?? []).filter(t => t.status !== 'CLOSED')
  const breached = open.filter(t => t.is_sla_breached).length
  const newToday = (tickets ?? []).filter(t => DAY_KEY.format(new Date(t.created_at)) === today).length
  const waitingTech = open.filter(t => t.status === 'NEW').length

  return (
    <div className="flex flex-col gap-5">
      {/* ── Hàng 4 ô KPI (mobile 2×2) — bọc Card giống EnvSensorPanel ở Dashboard Farm Owner; ô nằm trong khung
          nên bỏ shadow riêng (shadow-none), như ReadingTile ── */}
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-h2 text-charcoal">Chỉ số vận hành toàn hệ thống</h2>
          <p className="mt-1 text-sm text-warmGray">Trang trại, thiết bị, ticket và cảnh báo khẩn cấp trên mọi Farm</p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            className="shadow-none"
            icon={HouseIcon}
            iconClass={ICON_NORMAL}
            label="Trang trại hoạt động"
            value={farms.total}
            sub={`Gồm ${zones.total} phòng`}
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
            icon={TicketIcon}
            iconClass={ICON_NORMAL}
            label="Ticket đang mở"
            value={openTickets.total}
            // is_sla_breached = quá hạn XỬ LÝ (TICKET-FR-009, job slaBreach) — ghi rõ thay vì "vi phạm" chung chung.
            // Mọi ticket mở đều quá hạn → khỏi lặp lại con số; một phần thì ghi rõ bao nhiêu
            valueBadge={breached === 0 ? undefined : breached === openTickets.total ? 'đều quá hạn' : `${breached} quá hạn`}
            sub={`${newToday} mới hôm nay · ${waitingTech} chờ nhận`}
          />
          <StatTile
            className="shadow-none"
            icon={WarningIcon}
            iconClass={ICON_NORMAL}
            // Query chỉ lấy status ACTIVE — không ghi "đang mở" vì ACKNOWLEDGED cũng là đang mở (ALERT-FR-008/009).
            // Admin không xác nhận cảnh báo (chỉ Farm Owner/Technician) → dòng phụ nói ai chưa phản hồi, tránh
            // chữ "chờ xác nhận" khiến Admin tưởng việc đó của mình
            label="Cảnh báo CRITICAL"
            value={String(criticalAlerts.total)}
            sub={criticalAlerts.total > 0 ? 'Farm Owner chưa phản hồi' : 'Không có cảnh báo mới'}
          />
        </div>
      </Card>

      <TicketTrendChart />
      <RecentActivityCard />
    </div>
  )
}
