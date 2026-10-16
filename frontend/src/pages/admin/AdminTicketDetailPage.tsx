import { useState } from "react";
import { useParams } from "react-router-dom";
import { CheckIcon } from "@phosphor-icons/react";
import { useTicket } from "@/hooks/shared/useTickets";
import { useFarm, useFarmZones } from "@/hooks/shared/useFarms";
import { usePageBreadcrumb, usePageBack } from "@/hooks/common/useBreadcrumb";
import { Button, Badge } from "@/components/ui";
import { IconX } from "@/components/ui/icons";
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
import { technicianName } from "@/components/features/admin/tickets/ticketColumns";
import { formatDayTime } from "@/lib/helpers";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";
import { TICKET_TYPE_LABEL, STATUS_LABEL, PRIORITY_TONE } from "@/constants/tickets";
import { PRIORITY_LABEL } from "@/constants/sla";
import { SCHEDULED_TYPES } from "@/validations/common/schedule.validation";

/** Nút can thiệp: viền đậm hơn secondary mặc định (warmGray/15 gần như chìm vào card trắng) + bóng nhẹ để nhìn ra là nút bấm */
const ACTION_BUTTON = "border-warmGray/40 shadow-sm hover:border-charcoal/40 hover:bg-gray-50";

/**
 * Chi tiết 1 ticket cho Admin (/system/tickets/:id) — tách khỏi /tickets/:id dùng chung để
 * nút quay lại + breadcrumb về đúng bảng Ticket của Admin. Cùng khuôn trang Ticket: card trắng,
 * tiêu đề text-h2, không icon. 2 cột dưới cao bằng nhau.
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

  // Breadcrumb chỉ tên loại ticket — mã ticket đã bỏ khỏi trang chi tiết, không hiện lại ở header
  usePageBreadcrumb(ticket ? [{ label: TICKET_TYPE_LABEL[ticket.type] }] : []);
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
            <div className="min-w-0">
              {/* Tên ticket + nhãn ưu tiên/trạng thái cùng 1 hàng, thời gian bên dưới */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h2 className="text-h2 text-charcoal">{TICKET_TYPE_LABEL[ticket.type]}</h2>
                <Badge tone={PRIORITY_TONE[ticket.priority]} title={ticket.priority}>{PRIORITY_LABEL[ticket.priority]}</Badge>
                <Badge className={STATUS_BADGE_CLASS[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
              </div>
              <p className="mt-1 text-small text-warmGray">
                {t('Tạo {{time}}', { time: formatDayTime(ticket.created_at) })}
                {ticket.closed_at && ` — ${t('Đóng {{time}}', { time: formatDayTime(ticket.closed_at) })}`}
              </p>
            </div>
          </div>

          {/* Chỉ hiện khi ticket còn mở: backend cho Admin can thiệp cả ticket đã đóng (TICKET-FR-005b) nhưng chỉ để MỞ LẠI
              — 3 popup không có lựa chọn mở lại, nên gán lại bị 409, đổi ưu tiên/lịch hẹn của việc đã xong là vô nghĩa */}
          {isOpen && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="secondary" size="sm" className={ACTION_BUTTON} onClick={() => setShowChangePriority(true)}>Đổi ưu tiên</Button>
              <Button variant="secondary" size="sm" className={ACTION_BUTTON} onClick={() => setShowReassign(true)}>Gán lại kỹ thuật viên</Button>
              <Button variant="secondary" size="sm" className={ACTION_BUTTON} onClick={() => setShowReschedule(true)}>Đổi lịch hẹn</Button>
              {/* Nút viền + icon X như nút "Hủy lọc", không tô đỏ — popup xác nhận hủy mới là bước nguy hiểm */}
              <Button variant="secondary" size="sm" className={ACTION_BUTTON} onClick={() => setShowCancel(true)}>
                <IconX width={14} height={14} />
                Hủy ticket
              </Button>
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-warmGray/10 pt-4">
          <TicketStatusSteps status={ticket.status} />
        </div>
      </section>

      {/* ── 2 cột: nội dung chính | SLA + thông tin (rộng cố định 18rem — cột Lịch sử xử lý rộng hơn) ── */}
      {/* Màn lớn: cột trái đặt absolute trong ô lưới → chiều cao hàng do cột phải quyết định, khung Lịch sử xử lý cao
          bằng đúng tổng các khung bên phải (danh sách ghi chú tự cuộn bên trong) */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="relative min-w-0">
        <div className="flex flex-col gap-4 lg:absolute lg:inset-0">
          {SCHEDULED_TYPES.includes(ticket.type) && (
            <section className="rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
              <div className="mb-4">
                <h2 className="text-h2 text-charcoal">{t('Checklist nghiệm thu')}</h2>
                <p className="mt-1 text-sm text-warmGray">{t('Kỹ thuật viên xác nhận · {{done}}/{{total}} mục đạt', { done: satDone, total: satKeys.length })}</p>
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

          <TicketNotesCard ticketId={ticket._id} notes={ticket.notes} className="min-h-0 flex-1" />
        </div>
        </div>

        <div className="flex flex-col gap-4 self-start">
          <TicketSlaCard ticket={ticket} />

          {/* Card Thông tin cao vừa nội dung */}
          <section className="rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
            <h2 className="text-h3 text-charcoal">{t('Thông tin')}</h2>
            <dl className="mt-1 divide-y divide-warmGray/10">
              <Info label="Trang trại">{farm?.name ?? "—"}</Info>
              <Info label="Phòng">{room ? `${room.houseName} / ${room.name}` : ticket.zone_id ? "—" : "Toàn farm"}</Info>
              <Info label="Kỹ thuật viên phụ trách">
                {technician ?? <span className="font-semibold text-climateOrange">{t('Chưa phân công')}</span>}
              </Info>
              {ticket.scheduled_visit_at && (
                <Info label="Ngày hẹn">{formatDayTime(ticket.scheduled_visit_at)}</Info>
              )}
            </dl>
          </section>

          {/* TICKET-FR-011: Farm Owner đánh giá sau khi đóng — Admin chỉ xem kết quả */}
          {!isOpen && (
            <section className="rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
              <p className="label-caption mb-2">{t('Đánh giá của Farm Owner')}</p>
              {ticket.satisfaction_rating
                ? <StarRating value={ticket.satisfaction_rating} readOnly />
                : <p className="text-body italic text-warmGray">{t('Farm Owner chưa đánh giá ticket này.')}</p>}
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
