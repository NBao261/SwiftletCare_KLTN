import { CheckCircleIcon, ClockIcon, HourglassIcon, TimerIcon, TrayIcon, UsersThreeIcon, WarningCircleIcon, WrenchIcon, type Icon } from '@phosphor-icons/react'
import { useTicketKpi } from '@/hooks/shared/useTickets'
import { Button, EmptyState } from '@/components/ui'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import StatTile from '@/components/ui/StatTile'
import PriorityLegend from '@/components/features/admin/tickets/PriorityLegend'
import { STATUS_BADGE_CLASS } from '@/components/features/admin/tickets/tickets.constants'
import { formatDuration } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import { STATUS_LABEL } from '@/constants/tickets'
import type { TicketStatus } from '@/types'

const STATUS_ICON: Record<TicketStatus, Icon> = {
  NEW: TrayIcon,
  IN_PROGRESS: WrenchIcon,
  AWAITING_FIELD_CONFIRMATION: HourglassIcon,
  CLOSED: CheckCircleIcon,
}

const STATUS_ORDER = Object.keys(STATUS_LABEL) as TicketStatus[]
/** Dưới mức này tỉ lệ đúng hạn tô đỏ — cùng ngưỡng SlaCard ở Cài đặt hệ thống */
const SLA_WARN_RATE = 80
const HOUR_MS = 3_600_000

interface Props {
  /** Chuỗi đang tìm trên bảng — trùng tên KTV nào thì dòng KTV đó đang được chọn */
  search: string
  /** Bấm tên KTV → tìm theo tên đó trên bảng ('' → bỏ) */
  onSelectTechnician: (name: string) => void
}

/**
 * Khu thống kê trên bảng Ticket của Admin — TICKET-FR-012, GET /tickets/kpi (chỉ ADMIN), số
 * liệu toàn hệ thống (không theo bộ lọc bảng). Đọc từ trên xuống theo mức cần hành động:
 * - Hàng 5 ô số chỉ để xem: % đúng hạn SLA (cả ô đỏ nhạt khi dưới mục tiêu) rồi 4 trạng thái, icon tròn theo màu trạng thái.
 * - Bảng Kỹ thuật viên: sắp theo số ticket đang giữ (nhiều nhất lên đầu), để Admin thấy
 *   ai quá tải mà gán lại (TICKET-FR-005b). Bấm tên → bảng ticket chỉ còn ticket của người đó.
 */
export default function TicketInsights({ search, onSelectTechnician }: Props) {
  const { data: kpi, isLoading, isError, refetch } = useTicketKpi()

  if (isLoading) return <LoadingSkeleton count={1} className="h-72 w-full" />
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
  const total = STATUS_ORDER.reduce((sum, s) => sum + counts[s], 0)
  const rate = kpi.slaComplianceRate
  const slaBad = rate != null && rate < SLA_WARN_RATE

  // Chưa đóng = tổng được gán − đã đóng, tách 2 phần: chưa nhận (NEW, `unaccepted` của backend) và đang làm (Đang xử lý + Chờ xác nhận).
  // `closed` của backend gộp cả ticket bị huỷ (huỷ = status CLOSED + cancelled_at) → hoàn thành = closed − cancelled. KTV nhiều việc dở nhất lên đầu
  const technicians = kpi.byTechnician
    .map(t => ({ ...t, working: t.total - t.closed - t.unaccepted, completed: t.closed - t.cancelled }))
    .sort((a, b) => (b.unaccepted + b.working) - (a.unaccepted + a.working) || b.total - a.total)

  return (
    <div className="flex flex-col gap-4">
      {/* 5 ô bằng nhau trên desktop; mobile: ô SLA chiếm trọn hàng đầu, 4 ô trạng thái xếp 2×2 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          className="col-span-2 lg:col-span-1"
          icon={TimerIcon}
          iconClass={rate == null ? 'bg-warmGray/10 text-charcoal' : slaBad ? 'bg-alertRed text-white' : 'bg-accent-300 text-charcoal'}
          alert={slaBad}
          label="Đúng hạn SLA"
          value={rate != null ? `${rate}%` : '--'}
          // Trạng thái không chỉ bằng màu (FE_Design §13.11): dòng phụ ghi rõ "Dưới/Đạt mục tiêu"
          sub={rate != null
            ? `${slaBad ? 'Dưới' : 'Đạt'} mục tiêu ${SLA_WARN_RATE}% · ${kpi.ticketsPastDue} ticket tới hạn`
            : 'Chưa có ticket nào tới hạn'}
        />

        {/* Chỉ để xem — lọc theo trạng thái dùng SelectMenu ở thanh công cụ của bảng */}
        {STATUS_ORDER.map(s => (
          <StatTile
            key={s}
            icon={STATUS_ICON[s]}
            iconClass={STATUS_BADGE_CLASS[s]}
            label={STATUS_LABEL[s]}
            value={counts[s]}
            sub={`${total > 0 ? Math.round((counts[s] / total) * 100) : 0}% tổng số`}
          />
        ))}
      </div>

      {/* ── Hàng 2: Kỹ thuật viên (phần còn lại) + Mức ưu tiên & hạn SLA (rộng cố định 21rem, đủ cho
          "Khẩn cấp" không xuống dòng) — 2 card cao bằng nhau ── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section className="min-w-0 rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
        {/* Tiêu đề card text-h2 (FE_Design §2.8) + dòng phụ bên dưới — cùng khuôn với PriorityLegend */}
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-charcoal text-limeMist">
            <UsersThreeIcon size={20} weight="bold" />
          </span>
          <div className="min-w-0">
            <h2 className="text-h2 text-charcoal">Kỹ thuật viên</h2>
            <p className="truncate text-small text-graphite">Sắp theo số ticket chưa đóng · bấm tên để xem ticket của người đó</p>
          </div>
        </div>

        {technicians.length === 0 ? (
          <p className="rounded-xl border border-dashed border-warmGray/30 px-4 py-6 text-center text-body text-warmGray">
            Chưa có ticket nào được gán cho kỹ thuật viên.
          </p>
        ) : (
          // Tối đa ~6 dòng rồi cuộn — không đẩy bảng ticket xuống quá xa; tiêu đề cột dính trên khi cuộn
          <div className="max-h-72 overflow-auto [scrollbar-width:thin]">
            {/* table-fixed + width % (tổng 100): 28+11+11+13+9+13+15 — vừa khít từ ~600px trở lên, hẹp hơn mới cuộn ngang.
                Mọi cột số căn giữa — tiêu đề nằm ngay trên giá trị, khoảng cách giữa các cột đều nhau */}
            <table className="w-full min-w-[600px] table-fixed text-small">
              {/* Dải tiêu đề cột nền xám góc vuông, không xuống dòng — tách rõ khỏi các dòng, vẫn dính trên khi cuộn */}
              <thead className="sticky top-0 z-10 bg-white [&_th]:whitespace-nowrap [&_th]:bg-gray-100 [&_th]:px-1.5 [&_th]:py-2 [&_th]:text-graphite">
                <tr>
                  <th scope="col" className="label-caption w-[28%] !pl-3 text-left">Tên</th>
                  <th scope="col" className="label-caption w-[11%] text-center" title="Đã gán nhưng KTV chưa bấm tiếp nhận (trạng thái Mới)">
                    Chưa nhận
                  </th>
                  <th scope="col" className="label-caption w-[11%] text-center" title="Đã tiếp nhận, đang ở Đang xử lý hoặc Chờ xác nhận hiện trường">
                    Đang làm
                  </th>
                  <th scope="col" className="label-caption w-[13%] text-center" title="Đã đóng do xử lý xong">Hoàn thành</th>
                  <th scope="col" className="label-caption w-[9%] text-center" title="Đã đóng do bị hủy — không tính vào TB xử lý và SLA">Đã hủy</th>
                  <th scope="col" className="label-caption w-[13%] text-center">
                    <span className="inline-flex items-center gap-1"><ClockIcon size={12} />TB xử lý</span>
                  </th>
                  <th scope="col" className="label-caption w-[15%] text-center">Đúng hạn SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warmGray/10">
                {technicians.map(t => {
                  const name = t.full_name ?? t.email ?? 'Tài khoản đã xoá'
                  // Ô tìm kiếm của bảng khớp theo full_name (ticketColumns#technicianName) — không có tên thì không lọc được
                  const active = !!t.full_name && search === t.full_name
                  const techSlaBad = t.slaComplianceRate != null && t.slaComplianceRate < SLA_WARN_RATE
                  return (
                    <tr key={t.technician_id} className={cn('transition-colors', active && 'bg-limeMist')}>
                      <td className="py-2 pl-3 pr-2">
                        <button
                          type="button"
                          disabled={!t.full_name}
                          aria-pressed={active}
                          onClick={() => onSelectTechnician(active ? '' : t.full_name ?? '')}
                          className="group flex min-w-0 items-center gap-2.5 rounded-lg text-left disabled:cursor-default"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-charcoal text-small font-bold text-limeMist">
                            {name.charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className={cn('block truncate text-body font-semibold text-charcoal', t.full_name && 'group-hover:underline')}>{name}</span>
                            <span className="block text-small tabular-nums text-warmGray">{t.total} ticket</span>
                          </span>
                        </button>
                      </td>
                      {/* Chưa nhận > 0 tô cam — cùng màu ô "Mới" ở hàng trên, là việc Admin cần nhắc/gán lại */}
                      <td className={cn(
                        'px-2 py-2 text-center text-body font-bold tabular-nums',
                        t.unaccepted > 0 ? 'text-orange-600' : 'text-graphite',
                      )}>
                        {t.unaccepted}
                      </td>
                      <td className="px-2 py-2 text-center text-body font-bold tabular-nums text-charcoal">{t.working}</td>
                      <td className="px-2 py-2 text-center font-semibold tabular-nums text-accent-700">{t.completed}</td>
                      <td className="px-2 py-2 text-center tabular-nums text-graphite">{t.cancelled}</td>
                      <td className="px-2 py-2 text-center tabular-nums text-charcoal">
                        {t.avgResolveHours != null ? formatDuration(t.avgResolveHours * HOUR_MS) : '--'}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {/* Pill màu thay chữ màu: đỏ dưới mục tiêu, lime đạt — nổi hơn khi quét dọc cột */}
                        {t.slaComplianceRate != null ? (
                          <span className={cn(
                            'inline-block rounded-full px-2.5 py-0.5 font-semibold tabular-nums',
                            techSlaBad ? 'bg-red-100 text-red-600' : 'bg-lime-200 text-accent-800',
                          )}>
                            {t.slaComplianceRate}%
                          </span>
                        ) : <span className="text-graphite">--</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div>
        <PriorityLegend className="h-full" />
      </div>
      </div>
    </div>
  )
}
