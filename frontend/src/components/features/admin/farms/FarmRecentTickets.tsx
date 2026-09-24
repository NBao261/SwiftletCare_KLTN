import { Link, useNavigate } from "react-router-dom";
import { useTicketsList } from "@/hooks/shared/useTickets";
import { useFarmZones } from "@/hooks/shared/useFarms";
import { Badge } from "@/components/ui";
import EmptyState from "@/components/ui/EmptyState";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { IconTicket } from "@/components/ui/icons";
import { formatDate, formatRelativeTime } from "@/lib/helpers";
import { cn } from "@/lib/cn";
import { TICKET_TYPE_LABEL, STATUS_LABEL, STATUS_TONE, PRIORITY_TONE, PRIORITY_ICON_CLASS } from "@/constants/tickets";
import type { Ticket } from "@/types";

const RECENT_LIMIT = 5;

/**
 * Dòng phụ của 1 ticket: phòng · kỹ thuật viên · mô tả — mỗi phần 1 màu theo độ quan trọng:
 * phòng graphite, KTV charcoal đậm, "Chưa phân công" cam (cần chú ý), mô tả warmGray.
 */
function TicketMeta({ ticket, roomLabel }: { ticket: Ticket; roomLabel: string | undefined }) {
  const technician = typeof ticket.assigned_to === "object" ? ticket.assigned_to.full_name : undefined;
  const room = roomLabel ?? (ticket.zone_id ? undefined : "Toàn farm");
  const note = ticket.notes[0]?.content;
  return (
    <p className="mt-1 truncate text-sm text-warmGray">
      {room && <span className="font-medium text-graphite">{room} · </span>}
      {technician ? (
        <span>KTV: <span className="font-semibold text-charcoal">{technician}</span></span>
      ) : (
        <span className="font-semibold text-orange-600">Chưa phân công</span>
      )}
      {note && <span> · {note}</span>}
    </p>
  );
}

/** "Ticket gần nhất" cuối trang chi tiết Farm của Admin — FARM-FR-009 "ticket liên quan"; xem đủ ở /tickets */
export default function FarmRecentTickets({ farmId }: { farmId: string }) {
  const navigate = useNavigate();
  const { records, total, isLoading } = useTicketsList({ farmId, limit: RECENT_LIMIT });
  // Ticket chỉ có zone_id thô — tra tên "Nhà · Phòng" từ danh sách phòng phẳng đã cache (card Nhà yến cũng dùng)
  const { data: farmZones } = useFarmZones(farmId);
  const roomLabel = (zoneId?: string) => {
    const zone = zoneId ? farmZones?.find((z) => z._id === zoneId) : undefined;
    return zone && `${zone.houseName} · ${zone.name}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="font-bold text-charcoal">Ticket gần nhất</h2>
          {total > 0 && (
            <span className="shrink-0 rounded-full bg-limeMist px-2.5 py-1 text-[11px] font-semibold tabular-nums text-charcoal/70">
              {records.length}/{total}
            </span>
          )}
        </div>
        {total > 0 && (
          <Link to={`/system/tickets?farmId=${farmId}`} className="shrink-0 text-sm font-semibold text-charcoal hover:underline">
            Xem tất cả →
          </Link>
        )}
      </div>

      {isLoading && <LoadingSkeleton count={3} className="h-20 w-full" />}
      {!isLoading && records.length === 0 && (
        <EmptyState
          icon={<IconTicket width={28} height={28} />}
          title="Chưa có ticket nào"
          description="Ticket sự cố, lắp đặt và bảo trì của trang trại này sẽ hiện ở đây."
        />
      )}

      {/* 1 khung liền khối (cùng bo/viền/bóng với Card mặc định), mỗi ticket là 1 dòng ngăn bằng divide-y */}
      {records.length > 0 && (
        <div className="divide-y divide-warmGray/15 overflow-hidden rounded-2xl border border-warmGray/15 bg-white shadow-card">
          {records.map((ticket) => {
            const isOpen = ticket.status !== "CLOSED";
            const isBreached = ticket.is_sla_breached && isOpen;
            return (
              <button
                key={ticket._id}
                type="button"
                onClick={() => navigate(`/tickets/${ticket._id}`)}
                className={cn(
                  "flex w-full flex-col gap-2 px-5 py-4 text-left transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                  // Quá hạn SLA: nền trắng như thường, chỉ đỏ nhạt khi hover
                  isBreached ? "hover:bg-red-50" : "hover:bg-gray-50",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {/* Icon-box tô theo ưu tiên — cùng bảng màu với card SLA ở Cài đặt hệ thống (§2.7) */}
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", PRIORITY_ICON_CLASS[ticket.priority])}>
                    <IconTicket width={18} height={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge tone={PRIORITY_TONE[ticket.priority]} className="shrink-0">{ticket.priority}</Badge>
                      <p className="truncate text-base font-bold text-charcoal">{TICKET_TYPE_LABEL[ticket.type]}</p>
                      {isBreached && <Badge tone="critical" className="shrink-0">Quá hạn SLA</Badge>}
                    </div>
                    <TicketMeta ticket={ticket} roomLabel={roomLabel(ticket.zone_id)} />
                  </div>
                </div>

                {/* Mobile: xuống dưới, thụt theo icon-box; ≥640px: cột phải, thời gian căn phải để các dòng thẳng hàng */}
                <div className="flex shrink-0 items-center gap-3 pl-[52px] sm:pl-0">
                  <Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
                  <div className="whitespace-nowrap text-xs sm:min-w-32 sm:text-right">
                    <p className="font-semibold text-charcoal" title={formatDate(ticket.created_at)}>
                      {formatRelativeTime(ticket.created_at)}
                    </p>
                    {isOpen && ticket.sla_resolve_due_at && !isBreached && (
                      <p className="text-warmGray">Hạn xử lý {formatRelativeTime(ticket.sla_resolve_due_at)}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
