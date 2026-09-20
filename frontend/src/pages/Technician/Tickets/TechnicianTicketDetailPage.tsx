// TechnicianTicketDetailPage — SCR-TC02 / F-TC-02 / Stitch A2 + C3
// Chi tiết ticket Technician: layout + modal state management
// Logic nặng được tách sang ./components/
import { useState, useEffect } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useTicket } from '@/hooks/useTickets'
import { Badge, Card } from '@/components/ui'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { formatDate } from '@/utils/helpers'
import { TICKET_TYPE_LABEL, STATUS_LABEL, STATUS_TONE, PRIORITY_TONE } from '@/constants/tickets'
import { isSlaBreached, formatSlaCountdown, assigneeName } from './components/ticketHelpers'
import { StatusStepper }    from './components/StatusStepper'
import { SLABreachBanner }  from './components/SLABreachBanner'
import { SATChecklist }     from './components/SATChecklist'
import { AddNoteCard }      from './components/AddNoteCard'
import { UpdateStatusModal } from './components/UpdateStatusModal'
import { ReassignModal }    from './components/ReassignModal'
import { RescheduleModal }  from './components/RescheduleModal'
import { TicketChat }       from './components/TicketChat'

// ── Info row helper (local — only used here) ──────────────────────────────────
function InfoRow({ label, value, valueClass = 'text-charcoal' }: {
  label: string; value: string; valueClass?: string
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-warmGray">{label}</dt>
      <dd className={`mt-0.5 font-medium ${valueClass}`}>{value}</dd>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TechnicianTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { data: ticket, isLoading } = useTicket(id)

  const [statusModal,     setStatusModal]     = useState(false)
  const [reassignModal,   setReassignModal]   = useState(false)
  const [rescheduleModal, setRescheduleModal] = useState(false)

  // Trigger reschedule từ query param (nguồn: TicketsPage → "Sửa ngày hẹn" button)
  useEffect(() => {
    if (searchParams.get('action') === 'reschedule') setRescheduleModal(true)
  }, [searchParams])

  if (isLoading) return <LoadingSkeleton className="h-96 w-full" />
  if (!ticket) return (
    <EmptyState title="Không tìm thấy ticket" description="Ticket không tồn tại hoặc bạn không có quyền xem." />
  )

  const isInstallation = ticket.type === 'INSTALLATION' || ticket.type === 'MAINTENANCE'
  const sla = formatSlaCountdown(ticket)
  const breached = isSlaBreached(ticket)

  return (
    <div className="flex flex-col gap-5">
      {/* Back */}
      <Link to="/tickets" className="text-sm font-semibold text-charcoal hover:underline">
        ← Quay lại danh sách
      </Link>

      {/* C3: SLA Breach Banner */}
      {breached && ticket.status !== 'CLOSED' && <SLABreachBanner />}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>
          <h1 className="text-xl font-bold text-charcoal">{TICKET_TYPE_LABEL[ticket.type]}</h1>
          <Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
          <span className={`text-sm font-medium ${sla.breached ? 'text-alertRed' : 'text-warmGray'}`}>
            {sla.text}
          </span>
        </div>
        <span className="text-sm text-warmGray">Tạo lúc {formatDate(ticket.created_at)}</span>
      </div>

      {/* Status stepper */}
      <Card className="!p-5">
        <StatusStepper current={ticket.status} />
      </Card>

      {/* Main 2-col grid */}
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        {/* LEFT — actions + SAT + notes */}
        <div className="flex flex-col gap-5">
          {/* Action panel */}
          <Card className="!p-5">
            <p className="label-caption mb-3">HÀNH ĐỘNG</p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setStatusModal(true)}
                className="w-full rounded-full bg-charcoal py-3 text-sm font-semibold text-white hover:bg-charcoal/90"
              >
                Cập nhật trạng thái
              </button>
              <button
                onClick={() => setReassignModal(true)}
                className="w-full rounded-full border border-graphite/20 py-3 text-sm font-semibold text-charcoal hover:bg-graphite/5"
              >
                Yêu cầu gán lại
              </button>
              {isInstallation && (
                <button
                  onClick={() => setRescheduleModal(true)}
                  className="w-full rounded-full border border-graphite/20 py-3 text-sm font-semibold text-charcoal hover:bg-graphite/5"
                >
                  Sửa ngày hẹn khảo sát
                </button>
              )}
            </div>
          </Card>

          {isInstallation && (
            <SATChecklist ticketId={ticket._id} checklist={ticket.sat_checklist} />
          )}

          {/* Notes timeline */}
          <Card className="!p-5">
            <p className="label-caption mb-3">LỊCH SỬ GHI CHÚ</p>
            <div className="flex flex-col gap-2.5">
              {ticket.notes.length === 0 && (
                <p className="text-sm text-warmGray">Chưa có ghi chú nào.</p>
              )}
              {ticket.notes.map((note, i) => (
                <div
                  key={i}
                  className={`rounded-xl px-3.5 py-3 ${
                    !note.author_id
                      ? 'border border-alertRed/15 bg-alertRed/5'
                      : 'bg-warmGray/5'
                  }`}
                >
                  <p className="text-sm text-charcoal">{note.content}</p>
                  <p className="mt-1 text-xs text-warmGray">{formatDate(note.created_at)}</p>
                </div>
              ))}
            </div>
          </Card>

          <AddNoteCard ticketId={ticket._id} />

          {/* TICKET-FR-014..017: Chat realtime với Farm Owner */}
          <TicketChat ticketId={ticket._id} />
        </div>

        {/* RIGHT — ticket metadata */}
        <div>
          <Card className="!p-5">
            <p className="label-caption mb-3">THÔNG TIN TICKET</p>
            <dl className="flex flex-col gap-3">
              <InfoRow label="Độ ưu tiên" value={ticket.priority} />
              <InfoRow label="Loại"       value={TICKET_TYPE_LABEL[ticket.type]} />
              <InfoRow
                label="Trạng thái SLA"
                value={sla.text}
                valueClass={sla.breached ? 'text-alertRed font-semibold' : 'text-charcoal'}
              />
              {ticket.sla_resolve_due_at && (
                <InfoRow label="Hạn xử lý" value={formatDate(ticket.sla_resolve_due_at)} />
              )}
              {ticket.scheduled_visit_at && (
                <InfoRow label="Ngày hẹn" value={formatDate(ticket.scheduled_visit_at)} />
              )}
              <div className="border-t border-graphite/10 pt-3" />
              <InfoRow label="Kỹ thuật viên" value={assigneeName(ticket.assigned_to)} />
              <InfoRow label="Ngày tạo"      value={formatDate(ticket.created_at)} />
            </dl>
          </Card>
        </div>
      </div>

      {/* Modals */}
      {statusModal     && <UpdateStatusModal ticket={ticket} onClose={() => setStatusModal(false)} />}
      {reassignModal   && <ReassignModal     ticket={ticket} onClose={() => setReassignModal(false)} />}
      {rescheduleModal && <RescheduleModal   ticket={ticket} onClose={() => setRescheduleModal(false)} />}
    </div>
  )
}
