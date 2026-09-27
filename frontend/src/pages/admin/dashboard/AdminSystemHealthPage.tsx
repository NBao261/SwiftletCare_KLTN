// ADMIN — Tổng quan hệ thống (SYSTEM-FR-003), thay thế /system-status cũ. Bố cục theo mẫu "Tổng quan nền tảng":
// 1) hàng 4 ô KPI · 2) card xu hướng ticket & tuân thủ SLA 7 ngày (TicketTrendChart, 2 tab) · 3) nhật ký hoạt động gần
// đây (RecentActivityCard). Mọi số liệu là dữ liệu thật: health-overview, /tickets (đếm ở client), /tickets/kpi,
// /alerts, /system/audit-logs — không có số minh hoạ. Không phải BI đầy đủ (SYSTEM-FR-003).
// Tiêu đề trang lấy từ menu (AppHeader tự tra), không lặp lại trong nội dung.
import { CpuIcon, HouseIcon, TicketIcon, WarningIcon } from '@phosphor-icons/react'
import { useSystemHealth } from '@/hooks/admin/useSystem'
import { useAllTickets } from '@/hooks/admin/useAdminTickets'
import { useAlertsList } from '@/hooks/shared/useAlerts'
import StatTile from '@/components/ui/StatTile'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import TicketTrendChart from '@/components/features/admin/dashboard/TicketTrendChart'
import RecentActivityCard from '@/components/features/admin/dashboard/RecentActivityCard'
import { getApiErrorMessage } from '@/lib/helpers'

/** Khoá ngày theo giờ VN — để đếm "mới hôm nay" */
const DAY_KEY = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })

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
  const onlinePct = devices.total > 0 ? Math.round((devices.online / devices.total) * 1000) / 10 : 0
  const faulty = devices.error + devices.degraded

  const today = DAY_KEY.format(new Date())
  const open = (tickets ?? []).filter(t => t.status !== 'CLOSED')
  const breached = open.filter(t => t.is_sla_breached).length
  const newToday = (tickets ?? []).filter(t => DAY_KEY.format(new Date(t.created_at)) === today).length
  const waitingTech = open.filter(t => t.status === 'NEW').length

  return (
    <div className="flex flex-col gap-5">
      {/* ── Hàng 4 ô KPI — mobile 2×2 ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={HouseIcon}
          iconClass="bg-accent-300 text-charcoal"
          label="Trang trại hoạt động"
          value={farms.total}
          sub={`${zones.total} phòng trên toàn hệ thống`}
        />
        <StatTile
          icon={CpuIcon}
          iconClass={faulty > 0 ? 'bg-alertRed text-white' : 'bg-accent-300 text-charcoal'}
          alert={faulty > 0}
          label="Thiết bị online"
          value={`${onlinePct}%`}
          chip={`${devices.online}/${devices.total}`}
          progress={onlinePct}
          sub={faulty > 0 ? `${faulty} thiết bị lỗi/suy giảm cần xử lý` : `${devices.offline} offline · ${devices.pending} chờ kết nối`}
        />
        <StatTile
          icon={TicketIcon}
          iconClass="bg-charcoal text-limeMist"
          label="Ticket đang mở"
          value={openTickets.total}
          chip={breached > 0 ? `${breached} vi phạm SLA` : undefined}
          chipClass="bg-alertRed text-white"
          sub={`${newToday} mới hôm nay · ${waitingTech} chờ KTV nhận`}
        />
        <StatTile
          icon={WarningIcon}
          iconClass={criticalAlerts.total > 0 ? 'bg-alertRed text-white' : 'bg-warmGray/10 text-charcoal'}
          alert={criticalAlerts.total > 0}
          label="Cảnh báo CRITICAL đang mở"
          value={String(criticalAlerts.total).padStart(2, '0')}
          sub={criticalAlerts.total > 0 ? 'Chưa được xác nhận — xem trang Cảnh báo' : 'Không có cảnh báo khẩn cấp'}
        />
      </div>

      <TicketTrendChart />
      <RecentActivityCard />
    </div>
  )
}
