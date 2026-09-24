// Ticket Detail Page – TICKET-FR-001..004b/006/007/009/010/011
// Trang này dùng chung cho tất cả role — mỗi role nhìn thấy các phần UI khác nhau:
//   - Farm Owner / Admin: xem thông tin, huỷ, đánh giá, Admin can thiệp
//   - Technician: xem + cập nhật trạng thái, ghi chú, SAT checklist, chat, SLA breach banner
import { useState, FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTicket, useAddTicketNote, useCancelTicket, useRateTicket } from '@/hooks/shared/useTickets'
import { usePermission } from '@/hooks/common/usePermission'
import { usePageBreadcrumb } from '@/hooks/common/useBreadcrumb'
import { Button, Badge, Card, Textarea } from '@/components/ui'
import StarRating from '@/components/ui/StarRating'
import NoteActionModal from '@/components/ui/NoteActionModal'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import EmptyState from '@/components/ui/EmptyState'
import { useToastStore } from '@/stores/toastStore'
import { formatDate, getApiErrorMessage } from '@/lib/helpers'
import { TICKET_TYPE_LABEL, STATUS_LABEL, STATUS_TONE, PRIORITY_TONE } from '@/constants/tickets'
import { ChangePriorityModal, ReassignTicketModal, RescheduleModal } from '@/components/features/admin/tickets/AdminOverrideModals'
// ── Technician components ───────────────────────────────────────────────────
import { SAT_ITEMS } from '@/components/features/technician/tickets/ticketHelpers'
import { SLABreachBanner } from '@/components/features/technician/tickets/SLABreachBanner'
import { StatusStepper } from '@/components/features/technician/tickets/StatusStepper'
import { TicketChat } from '@/components/features/technician/tickets/TicketChat'

function assigneeName(assigned: string | { full_name: string; email: string } | undefined): string | undefined {
  return typeof assigned === 'object' ? assigned.full_name : undefined
}

export default function TechnicianTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: ticket, isLoading } = useTicket(id)
  const [showCancel, setShowCancel] = useState(false)
  const [showChangePriority, setShowChangePriority] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  // Backend: PUT /tickets/:id/cancel và POST /tickets/:id/rating chỉ cho FARM_OWNER, ADMIN
  const canManageTicket = usePermission('FARM_OWNER', 'ADMIN')
  // TICKET-FR-005b — quyền can thiệp thường trực của Admin trên MỌI ticket, bất
  // kể trạng thái/SLA (không gate theo status !== 'CLOSED' như canCancel).
  // 3 modal ở AdminOverrideModals.tsx, cùng gọi PUT /tickets/:id/admin-override.
  const canAdminIntervene = usePermission('ADMIN')
  // Breadcrumb AppHeader: "Ticket / <loại> #<6 ký tự cuối id>" — dẫn xuất từ chính route :id, không có API riêng trả "tiêu đề" ticket
  usePageBreadcrumb(ticket ? [{ label: `${TICKET_TYPE_LABEL[ticket.type]} #${ticket._id.slice(-6)}` }] : [])

  if (isLoading) return <LoadingSkeleton className="h-96 w-full" />
  if (!ticket) return <EmptyState title="Không tìm thấy ticket" description="Ticket có thể đã bị xoá hoặc bạn không có quyền xem." />

  const isInstallation = ticket.type === 'INSTALLATION' || ticket.type === 'MAINTENANCE'
  const canCancel = canManageTicket && ticket.status !== 'CLOSED'

  return (
    <div className="flex flex-col gap-5">
      <Link 
        to="/tickets" 
        className="group inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-warmGray shadow-sm ring-1 ring-inset ring-warmGray/10 transition-all hover:bg-warmGray/5 hover:text-charcoal"
      >
        <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
        Quay lại danh sách
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>
              <Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-charcoal">{TICKET_TYPE_LABEL[ticket.type]}</h1>
              <p className="mt-1 text-sm font-medium text-warmGray">Tạo lúc {formatDate(ticket.created_at)}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {canAdminIntervene && (
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowChangePriority(true)}>Đổi ưu tiên</Button>
                <Button variant="secondary" size="sm" onClick={() => setShowReassign(true)}>Gán lại KTV</Button>
                <Button variant="secondary" size="sm" onClick={() => setShowReschedule(true)}>Đổi lịch hẹn</Button>
              </div>
            )}
            {canCancel && (
              <Button variant="danger" size="sm" onClick={() => setShowCancel(true)}>Hủy ticket</Button>
            )}
          </div>
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-12 gap-y-4 border-t border-warmGray/10 pt-4 text-sm">
          <InfoItem label="Kỹ thuật viên phụ trách" value={assigneeName(ticket.assigned_to) ?? 'Chưa gán'} />
          {ticket.scheduled_visit_at && <InfoItem label="Ngày hẹn" value={formatDate(ticket.scheduled_visit_at)} />}
          {ticket.sla_resolve_due_at && <InfoItem label="Hạn xử lý (SLA)" value={formatDate(ticket.sla_resolve_due_at)} />}
          {ticket.is_sla_breached && <InfoItem label="Trạng thái SLA" value="Đã vượt hạn" warn />}
        </dl>
      </Card>

      {/* Technician: SLA Breach Banner */}
      {ticket.is_sla_breached && <SLABreachBanner />}

      {/* Technician: Status Stepper */}
      <StatusStepper current={ticket.status} />

      {isInstallation && (
        <Card>
          <p className="label-caption mb-3">Checklist nghiệm thu (Technician xác nhận)</p>
          <div className="flex flex-col gap-2">
            {SAT_ITEMS.map(item => (
              <div key={item.key} className="flex items-center gap-2.5 text-sm">
                <span className={cnDot(ticket.sat_checklist[item.key])} />
                <span className={ticket.sat_checklist[item.key] ? 'text-charcoal' : 'text-warmGray'}>{item.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <NotesTimeline ticketId={ticket._id} notes={ticket.notes} />

      {/* Technician: Real-time chat */}
      {ticket.status !== 'CLOSED' && <TicketChat ticketId={ticket._id} />}

      {ticket.status === 'CLOSED' && (
        <RatingCard ticketId={ticket._id} existingRating={ticket.satisfaction_rating} />
      )}

      <CancelTicketModal open={showCancel} onClose={() => setShowCancel(false)} ticketId={ticket._id} />
      {canAdminIntervene && (
        <>
          <ChangePriorityModal open={showChangePriority} onClose={() => setShowChangePriority(false)} ticket={ticket} />
          <ReassignTicketModal open={showReassign} onClose={() => setShowReassign(false)} ticket={ticket} />
          <RescheduleModal open={showReschedule} onClose={() => setShowReschedule(false)} ticket={ticket} />
        </>
      )}
    </div>
  )
}

function cnDot(ok: boolean): string {
  return `h-2.5 w-2.5 shrink-0 rounded-full ${ok ? 'bg-limeMist border border-charcoal/20' : 'bg-warmGray/30'}`
}

function InfoItem({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-warmGray">{label}</p>
      <p className={warn ? 'font-semibold text-alertRed' : 'font-medium text-charcoal'}>{value}</p>
    </div>
  )
}

function NotesTimeline({ ticketId, notes }: { ticketId: string; notes: Array<{ content: string; created_at: string }> }) {
  const addNote = useAddTicketNote()
  const push = useToastStore(s => s.push)
  const [content, setContent] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    addNote.mutate({ id: ticketId, content }, {
      onSuccess: () => setContent(''),
      onError: (err) => push(getApiErrorMessage(err, 'Thêm ghi chú thất bại'), 'error'),
    })
  }

  return (
    <Card>
      <p className="label-caption mb-3">Lịch sử xử lý</p>
      <div className="flex flex-col gap-3">
        {notes.length === 0 && <p className="text-sm text-warmGray">Chưa có ghi chú nào.</p>}
        {notes.map((note, i) => (
          <div key={i} className="rounded-xl bg-warmGray/5 px-3.5 py-2.5">
            <p className="text-sm text-charcoal">{note.content}</p>
            <p className="mt-1 text-xs text-warmGray">{formatDate(note.created_at)}</p>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 border-t border-warmGray/10 pt-4">
        <Textarea placeholder="Thêm ghi chú..." value={content} onChange={e => setContent(e.target.value)} />
        <Button type="submit" variant="secondary" size="sm" loading={addNote.isPending} className="self-end">
          Thêm ghi chú
        </Button>
      </form>
    </Card>
  )
}

function RatingCard({ ticketId, existingRating }: { ticketId: string; existingRating?: number }) {
  const rateTicket = useRateTicket()
  const push = useToastStore(s => s.push)
  const [rating, setRating] = useState(existingRating ?? 0)
  // Backend: POST /tickets/:id/rating chỉ cho FARM_OWNER, ADMIN
  const canRate = usePermission('FARM_OWNER', 'ADMIN')

  if (existingRating) {
    return (
      <Card>
        <p className="label-caption mb-2">Bạn đã đánh giá</p>
        <StarRating value={existingRating} readOnly />
      </Card>
    )
  }

  if (!canRate) return null

  return (
    <Card>
      <p className="label-caption mb-2">Đánh giá mức độ hài lòng</p>
      <div className="flex items-center gap-4">
        <StarRating value={rating} onChange={setRating} />
        <Button
          size="sm" disabled={rating === 0} loading={rateTicket.isPending}
          onClick={() => rateTicket.mutate({ id: ticketId, rating }, {
            onSuccess: () => push('Đã gửi đánh giá, cảm ơn bạn!'),
            onError: (err) => push(getApiErrorMessage(err, 'Gửi đánh giá thất bại'), 'error'),
          })}
        >
          Gửi
        </Button>
      </div>
    </Card>
  )
}

function CancelTicketModal({ open, onClose, ticketId }: { open: boolean; onClose: () => void; ticketId: string }) {
  const cancelTicket = useCancelTicket()
  const push = useToastStore(s => s.push)

  return (
    <NoteActionModal
      open={open}
      onClose={onClose}
      title="Hủy ticket"
      label="Lý do hủy"
      placeholder="VD: Đã tự khắc phục được, không cần lắp nữa..."
      submitLabel="Hủy ticket"
      required
      danger
      loading={cancelTicket.isPending}
      onSubmit={(reason) => {
        cancelTicket.mutate({ id: ticketId, reason }, {
          onSuccess: () => { push('Đã hủy ticket'); onClose() },
          onError: (err) => push(getApiErrorMessage(err, 'Hủy ticket thất bại'), 'error'),
        })
      }}
    />
  )
}
