import { CheckCircleIcon, HourglassIcon, TimerIcon, TrayIcon, WarningCircleIcon, WrenchIcon, type Icon } from '@phosphor-icons/react'
import { useTicketKpi } from '@/hooks/shared/useTickets'
import { Button, Card, EmptyState } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import StatTile from '@/components/ui/StatTile'
import { STATUS_LABEL } from '@/constants/tickets'
import { t } from '@/i18n'
import type { TicketStatus } from '@/types'

const STATUS_ICON: Record<TicketStatus, Icon> = {
  NEW: TrayIcon,
  IN_PROGRESS: WrenchIcon,
  AWAITING_FIELD_CONFIRMATION: HourglassIcon,
  CLOSED: CheckCircleIcon,
}

const STATUS_ORDER = Object.keys(STATUS_LABEL) as TicketStatus[]
/** Vòng icon xám như các ô trang Tổng quan/Người dùng/Thiết bị (theo ReadingTile Dashboard Farm Owner) */
const ICON = 'bg-warmGray/10 text-charcoal'
/** Nhãn ô ngắn hơn nhãn trạng thái chung — "Chờ xác nhận hiện trường" dài, xuống 2 dòng trong ô */
const STATUS_TILE_LABEL: Partial<Record<TicketStatus, string>> = { AWAITING_FIELD_CONFIRMATION: 'Chờ xác nhận' }
/** Dòng phụ: 1 cụm ngắn, đời thường — ticket đang ở bước nào (TICKET-FR-007) */
const STATUS_SUB: Record<Exclude<TicketStatus, 'CLOSED'>, string> = {
  NEW: 'Chưa có ai nhận',
  IN_PROGRESS: 'Kỹ thuật viên đang làm',
  AWAITING_FIELD_CONFIRMATION: 'Làm xong, chờ xác nhận',
}
/** Ngưỡng mục tiêu tỉ lệ đúng hạn — cùng ngưỡng SlaCard ở Cấu hình mặc định */
const SLA_WARN_RATE = 80

/**
 * Card "Thống kê ticket" đầu trang Ticket của Admin — TICKET-FR-012, GET /tickets/kpi (chỉ ADMIN), số liệu toàn hệ
 * thống (không theo bộ lọc bảng): % đúng hạn SLA rồi 4 trạng thái, icon xám, dòng phụ nói trạng thái đó là bước nào.
 * Bảng theo từng kỹ thuật viên nằm ở tab "Kỹ thuật viên" (TechnicianWorkloadTable).
 */
export default function TicketInsights() {
  const { data: kpi, isLoading, isError, refetch } = useTicketKpi()

  if (isLoading) return <LoadingSkeleton count={1} className="h-40 w-full" />
  if (isError || !kpi) {
    return (
      <EmptyState
        icon={<WarningCircleIcon size={32} />}
        title="Không tải được thống kê ticket"
        description="Kiểm tra kết nối tới máy chủ rồi thử lại."
        action={<Button variant="secondary" size="sm" onClick={() => refetch()}>Thử lại</Button>}
      />
    )
  }

  const counts = Object.fromEntries(STATUS_ORDER.map(s => [s, kpi.byStatus.find(r => r._id === s)?.count ?? 0])) as Record<TicketStatus, number>
  // Huỷ = status CLOSED + cancelled_at; resolvedTickets của backend chỉ đếm CLOSED không huỷ (ticket.service#getKpi)
  const cancelled = Math.max(0, counts.CLOSED - kpi.resolvedTickets)
  const rate = kpi.slaComplianceRate
  const slaBad = rate != null && rate < SLA_WARN_RATE

  return (
      // Cùng kiểu card "Chỉ số vận hành toàn hệ thống" (Tổng quan): bọc Card + tiêu đề, ô bỏ shadow riêng, icon xám
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-h2 text-charcoal">{t('Thống kê ticket')}</h2>
          <p className="mt-1 text-sm text-warmGray">{t('Tình trạng xử lý và mức đúng hạn SLA trên toàn hệ thống')}</p>
        </div>

        {/* 5 ô bằng nhau trên desktop; mobile: ô SLA chiếm trọn hàng đầu, 4 ô trạng thái xếp 2×2 */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatTile
            className="col-span-2 shadow-none lg:col-span-1"
            icon={TimerIcon}
            iconClass={ICON}
            label="Đúng hạn SLA"
            // Làm tròn số nguyên — "1.7%" khó đọc hơn "2%"
            value={rate != null ? `${Math.round(rate)}%` : '--'}
            // Trạng thái không chỉ bằng màu (FE_Design §13.11): dòng phụ ghi rõ đạt hay chưa đạt mục tiêu
            sub={rate != null ? t(slaBad ? 'Chưa đạt mục tiêu {{n}}%' : 'Đạt mục tiêu {{n}}%', { n: SLA_WARN_RATE }) : 'Chưa có ticket tới hạn'}
          />

          {/* Chỉ để xem — lọc theo trạng thái dùng SelectMenu ở thanh công cụ của bảng. Dòng phụ nói trạng thái đó
              nghĩa là gì (thay cho "% tổng số" — tỉ lệ không giúp Admin làm gì) */}
          {STATUS_ORDER.map(s => (
            <StatTile
              key={s}
              className="shadow-none"
              icon={STATUS_ICON[s]}
              iconClass={ICON}
              label={STATUS_TILE_LABEL[s] ?? STATUS_LABEL[s]}
              value={counts[s]}
              sub={s === 'CLOSED' ? t('{{done}} xong · {{cancelled}} huỷ', { done: kpi.resolvedTickets, cancelled }) : STATUS_SUB[s]}
            />
          ))}
        </div>
      </Card>
  )
}
