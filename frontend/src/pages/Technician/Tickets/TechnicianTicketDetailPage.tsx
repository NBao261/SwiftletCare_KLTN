// TechnicianTicketDetailPage — SCR-TC02 / F-TC-02 / Stitch A2 + C3
// Chi tiết ticket Technician: layout + modal state management
// Logic nặng được tách sang ./components/
import { useState, useEffect } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTicket } from '@/hooks/useTickets'
import { ticketApi } from '@/services/api/tickets'
import { Badge, Card } from '@/components/ui'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { formatDate, getApiErrorMessage } from '@/utils/helpers'
import { useToastStore } from '@/store/toastStore'
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

  // Escalate khi SLA vi phạm
  const queryClient = useQueryClient()
  const push = useToastStore(s => s.push)
  const escalateMut = useMutation({
    mutationFn: () => ticketApi.escalate(ticket?._id ?? '', 'SLA vi phạm — yêu cầu xử lý khẩn'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      push('Đã gửi yêu cầu escalate lên Admin')
    },
    onError: (err) => push(getApiErrorMessage(err, 'Escalate thất bại'), 'error'),
  })

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
      {/* Back — tăng click area, dễ bấm mobile */}
      <Link
        to="/tickets"
        className="inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-graphite/8 hover:underline"
      >
        ← Quay lại danh sách
      </Link>

      {breached && ticket.status !== 'CLOSED' && (
        <SLABreachBanner
          onEscalate={() => escalateMut.mutate()}
          isEscalating={escalateMut.isPending}
        />
      )}

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
        {/* LEFT — actions + SAT + notes + chat */}
        <div className="flex flex-col gap-5">
          {/* Action panel */}
          <Card className="!p-5">
            <p className="label-caption mb-3">HÀNH ĐỘNG</p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setStatusModal(true)}
                disabled={ticket.status === 'CLOSED'}
                className="w-full rounded-full bg-charcoal py-3 text-sm font-semibold text-white transition-colors hover:bg-charcoal/90 disabled:cursor-not-allowed disabled:opacity-40"
                title={ticket.status === 'CLOSED' ? 'Ticket đã đóng, không thể cập nhật' : ''}
              >
                Cập nhật trạng thái
              </button>
              <button
                onClick={() => setReassignModal(true)}
                disabled={ticket.status === 'CLOSED'}
                className="w-full rounded-full border border-graphite/20 py-3 text-sm font-semibold text-charcoal transition-colors hover:bg-graphite/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Yêu cầu gán lại
              </button>
              {isInstallation && (
                <button
                  onClick={() => setRescheduleModal(true)}
                  disabled={ticket.status === 'CLOSED'}
                  className="w-full rounded-full border border-graphite/20 py-3 text-sm font-semibold text-charcoal transition-colors hover:bg-graphite/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sửa ngày hẹn khảo sát
                </button>
              )}
            </div>
            {/* Closed state notice */}
            {ticket.status === 'CLOSED' && (
              <p className="mt-3 text-center text-xs text-warmGray">
                🔒 Ticket đã đóng — mọi thao tác đã bị khoá
              </p>
            )}
          </Card>

          {isInstallation && (
            <SATChecklist ticketId={ticket._id} checklist={ticket.sat_checklist} />
          )}

          {/* Notes timeline */}
          <Card className="!p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="label-caption">LỊCH SỬ GHI CHÚ</p>
              <span className="text-xs text-warmGray">{ticket.notes.length} ghi chú</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {ticket.notes.length === 0 && (
                <p className="py-3 text-center text-sm text-warmGray">Chưa có ghi chú nào.</p>
              )}
              {/* Dùng note._id hoặc created_at làm key thay vì index để tránh reconcile sai */}
              {ticket.notes.map((note, i) => (
                <div
                  key={note.created_at ?? i}
                  className={`rounded-xl px-3.5 py-3 ${
                    !note.author_id
                      ? 'border border-alertRed/15 bg-alertRed/5'   // system note
                      : 'bg-warmGray/5'
                  }`}
                >
                  <p className="text-sm text-charcoal">{note.content}</p>
                  <p className="mt-1 text-xs text-warmGray">{formatDate(note.created_at)}</p>
                </div>
              ))}
            </div>
          </Card>

          <AddNoteCard ticketId={ticket._id} disabled={ticket.status === 'CLOSED'} />

          {/* TICKET-FR-014..017: Chat realtime với Farm Owner */}
          <TicketChat ticketId={ticket._id} />
        </div>

        {/* RIGHT — ticket metadata (sticky khi scroll) */}
        <div className="lg:sticky lg:top-6 lg:self-start">
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

            {/* Quick actions shortcut */}
            <div className="mt-4 border-t border-graphite/10 pt-4">
              <p className="label-caption mb-2">THAO TÁC NHANH</p>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => setStatusModal(true)}
                  disabled={ticket.status === 'CLOSED'}
                  className="w-full rounded-lg border border-graphite/15 py-2 text-xs font-medium text-charcoal transition-colors hover:bg-graphite/5 disabled:opacity-40"
                >
                  ✏️ Cập nhật trạng thái
                </button>
                {isInstallation && (
                  <button
                    onClick={() => setRescheduleModal(true)}
                    disabled={ticket.status === 'CLOSED'}
                    className="w-full rounded-lg border border-graphite/15 py-2 text-xs font-medium text-charcoal transition-colors hover:bg-graphite/5 disabled:opacity-40"
                  >
                    📅 Sửa ngày hẹn
                  </button>
                )}
              </div>
            </div>
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
