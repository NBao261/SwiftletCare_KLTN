import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  CalendarBlankIcon, CheckIcon, DoorIcon, HouseIcon, ListChecksIcon, StarIcon, UserIcon, WrenchIcon,
} from "@phosphor-icons/react";
import { useTicket } from "@/hooks/shared/useTickets";
import { useFarm, useFarmZones } from "@/hooks/shared/useFarms";
import { usePageBreadcrumb, usePageBack } from "@/hooks/common/useBreadcrumb";
import { Button, Badge } from "@/components/ui";
import StarRating from "@/components/ui/StarRating";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import ChangePriorityModal from "@/components/features/admin/tickets/ChangePriorityModal";
import ReassignTicketModal from "@/components/features/admin/tickets/ReassignTicketModal";
import RescheduleModal from "@/components/features/admin/tickets/RescheduleModal";
import CancelTicketModal from "@/components/features/admin/tickets/CancelTicketModal";
import TicketNotesCard from "@/components/features/admin/tickets/TicketNotesCard";
import TicketStatusSteps from "@/components/features/admin/tickets/TicketStatusSteps";
import TicketSlaCard from "@/components/features/admin/tickets/TicketSlaCard";
import Info from "@/components/features/admin/tickets/TicketInfoItem";
import { SAT_LABEL, STATUS_BADGE_CLASS } from "@/components/features/admin/tickets/tickets.constants";
import { ticketCode, technicianName } from "@/components/features/admin/tickets/ticketColumns";
import { formatDate } from "@/lib/helpers";
import { cn } from "@/lib/cn";
import { TICKET_TYPE_LABEL, STATUS_LABEL, PRIORITY_TONE } from "@/constants/tickets";
import { PRIORITY_LABEL } from "@/constants/sla";
import { SCHEDULED_TYPES } from "@/validations/admin/ticket.validation";

/**
 * Chi tiết 1 ticket cho Admin (/system/tickets/:id) — tách khỏi /tickets/:id dùng chung để
 * nút quay lại + breadcrumb về đúng bảng Ticket của Admin. Cùng khuôn trang Ticket: card trắng,
 * tiêu đề text-h2 + ô icon charcoal.
 * - Card đầu: ưu tiên/trạng thái/mã, loại ticket, 4 nút can thiệp thường trực (TICKET-FR-005b) + huỷ, tiến trình 4 bước.
 * - Cột trái: checklist nghiệm thu (lắp đặt/bảo trì) + lịch sử xử lý.
 * - Cột phải (rộng cố định 21rem như card Mức ưu tiên): hạn SLA, thông tin, đánh giá — chỉ XEM
 *   (TICKET-FR-011 là việc của Farm Owner).
 */
export default function AdminTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: ticket, isLoading } = useTicket(id);
  const { data: farm } = useFarm(ticket?.farm_id);
  // Ticket chỉ có zone_id thô — tra "Nhà / Phòng" từ danh sách phòng phẳng của farm (đã cache)
  const { data: rooms } = useFarmZones(ticket?.zone_id ? ticket.farm_id : undefined);
  const [showCancel, setShowCancel] = useState(false);
  const [showChangePriority, setShowChangePriority] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  usePageBreadcrumb(ticket ? [{ label: `${TICKET_TYPE_LABEL[ticket.type]} ${ticketCode(ticket)}` }] : []);
  usePageBack("/system/tickets", "danh sách ticket");

  if (isLoading) return <LoadingSkeleton className="h-96 w-full" />;
  if (!ticket) return <EmptyState title="Không tìm thấy ticket" description="Ticket có thể đã bị xoá." />;

  const isOpen = ticket.status !== "CLOSED";
  const room = ticket.zone_id ? rooms?.find((r) => r._id === ticket.zone_id) : undefined;
  const technician = technicianName(ticket);
  const satKeys = Object.keys(SAT_LABEL) as (keyof typeof SAT_LABEL)[];
  const satDone = satKeys.filter((k) => ticket.sat_checklist[k]).length;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Card đầu: nhận diện ticket + thao tác + tiến trình ── */}
      <section className="rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-charcoal text-limeMist">
              <WrenchIcon size={24} weight="bold" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority} · {PRIORITY_LABEL[ticket.priority]}</Badge>
                <Badge className={STATUS_BADGE_CLASS[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
                <span className="font-mono text-small text-warmGray">{ticketCode(ticket)}</span>
              </div>
              <h2 className="mt-1.5 text-h2 text-charcoal">{TICKET_TYPE_LABEL[ticket.type]}</h2>
              <p className="text-small text-warmGray">
                Tạo lúc {formatDate(ticket.created_at)}
                {ticket.closed_at && ` · Đóng lúc ${formatDate(ticket.closed_at)}`}
              </p>
            </div>
          </div>

          {/* Can thiệp không gate theo trạng thái — quyền thường trực của Admin (TICKET-FR-005b); huỷ chỉ khi còn mở */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowChangePriority(true)}>Đổi ưu tiên</Button>
            <Button variant="secondary" size="sm" onClick={() => setShowReassign(true)}>Gán lại KTV</Button>
            <Button variant="secondary" size="sm" onClick={() => setShowReschedule(true)}>Đổi lịch hẹn</Button>
            {isOpen && <Button variant="danger" size="sm" onClick={() => setShowCancel(true)}>Hủy ticket</Button>}
          </div>
        </div>

        <div className="mt-5 border-t border-warmGray/10 pt-4">
          <TicketStatusSteps status={ticket.status} />
        </div>
      </section>

      {/* ── 2 cột: nội dung chính | SLA + thông tin (rộng cố định 21rem) ── */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {SCHEDULED_TYPES.includes(ticket.type) && (
            <section className="rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-charcoal text-limeMist">
                  <ListChecksIcon size={20} weight="bold" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-h2 text-charcoal">Checklist nghiệm thu</h2>
                  <p className="text-small text-graphite">Kỹ thuật viên xác nhận · {satDone}/{satKeys.length} mục đạt</p>
                </div>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {satKeys.map((key) => {
                  const ok = ticket.sat_checklist[key];
                  return (
                    <li
                      key={key}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-body",
                        ok ? "bg-limeMist text-charcoal" : "bg-warmGray/5 text-warmGray",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                          ok ? "bg-charcoal text-limeMist" : "border border-warmGray/30",
                        )}
                      >
                        {ok && <CheckIcon size={11} weight="bold" />}
                      </span>
                      {SAT_LABEL[key]}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <TicketNotesCard ticketId={ticket._id} notes={ticket.notes} />
        </div>

        <div className="flex flex-col gap-4">
          <TicketSlaCard ticket={ticket} />

          <section className="rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
            <h2 className="text-h3 text-charcoal">Thông tin</h2>
            <dl className="mt-1 divide-y divide-warmGray/10">
              <Info icon={HouseIcon} label="Trang trại">{farm?.name ?? "—"}</Info>
              <Info icon={DoorIcon} label="Phòng">{room ? `${room.houseName} / ${room.name}` : ticket.zone_id ? "—" : "Toàn farm"}</Info>
              <Info icon={UserIcon} label="Kỹ thuật viên phụ trách">
                {technician ?? <span className="font-semibold text-orange-600">Chưa phân công</span>}
              </Info>
              {ticket.scheduled_visit_at && (
                <Info icon={CalendarBlankIcon} label="Ngày hẹn">{formatDate(ticket.scheduled_visit_at)}</Info>
              )}
            </dl>
          </section>

          {/* TICKET-FR-011: Farm Owner đánh giá sau khi đóng — Admin chỉ xem kết quả */}
          {!isOpen && (
            <section className="rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="label-caption">Đánh giá của Farm Owner</span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <StarIcon size={14} weight="fill" />
                </span>
              </div>
              {ticket.satisfaction_rating
                ? <StarRating value={ticket.satisfaction_rating} readOnly />
                : <p className="text-body text-warmGray">Farm Owner chưa đánh giá ticket này.</p>}
            </section>
          )}
        </div>
      </div>

      <CancelTicketModal open={showCancel} onClose={() => setShowCancel(false)} ticketId={ticket._id} />
      <ChangePriorityModal open={showChangePriority} onClose={() => setShowChangePriority(false)} ticket={ticket} />
      <ReassignTicketModal open={showReassign} onClose={() => setShowReassign(false)} ticket={ticket} />
      <RescheduleModal open={showReschedule} onClose={() => setShowReschedule(false)} ticket={ticket} />
    </div>
  );
}
