// Ticket Detail Page – TICKET-FR-001..004b/006/007/009/010/011
import { useState, FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTicket, useAddTicketNote, useCancelTicket, useRateTicket } from '@/hooks/useTickets'
import { Button, Badge, Card, Textarea, Modal } from '@/components/ui'
import StarRating from '@/components/common/StarRating'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { useToastStore } from '@/store/toastStore'
import { formatDate, getApiErrorMessage } from '@/utils/helpers'
import type { TicketStatus, TicketType } from '@/types'

const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  SENSOR_FAULT: 'Lỗi cảm biến', RS485_BUS_FAILURE: 'Lỗi bus RS485', ACTUATOR_FAILURE: 'Lỗi thiết bị chấp hành',
  NODE_OFFLINE: 'Thiết bị mất kết nối', EDGE_AI_DEGRADED: 'Camera AI suy giảm', POWER_OUTAGE: 'Mất điện',
  SPEAKER_FAILURE: 'Lỗi loa ru', PREDATOR_DETECTED: 'Phát hiện thiên địch',
  INSTALLATION: 'Yêu cầu lắp đặt mới', MAINTENANCE: 'Bảo trì định kỳ', OTHER: 'Khác',
}
const STATUS_LABEL: Record<TicketStatus, string> = {
  NEW: 'Mới', IN_PROGRESS: 'Đang xử lý', AWAITING_FIELD_CONFIRMATION: 'Chờ xác nhận hiện trường', CLOSED: 'Đã đóng',
}
const STATUS_TONE = { NEW: 'critical', IN_PROGRESS: 'warning', AWAITING_FIELD_CONFIRMATION: 'info', CLOSED: 'neutral' } as const
const PRIORITY_TONE = { P1: 'critical', P2: 'warning', P3: 'neutral' } as const
const SAT_LABEL = {
  modbus_addresses_ok: '5 địa chỉ Modbus phản hồi đúng',
  camera_rtsp_ok: 'Camera RTSP ổn định',
  lte_connection_ok: 'Kết nối 4G ổn định',
  relay_test_ok: 'Relay đóng/ngắt đúng',
} as const

function assigneeName(assigned: string | { full_name: string; email: string } | undefined): string | undefined {
  return typeof assigned === 'object' ? assigned.full_name : undefined
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: ticket, isLoading } = useTicket(id)
  const [showCancel, setShowCancel] = useState(false)

  if (isLoading) return <LoadingSkeleton className="h-96 w-full" />
  if (!ticket) return <EmptyState title="Không tìm thấy ticket" description="Ticket có thể đã bị xoá hoặc bạn không có quyền xem." />

  const isInstallation = ticket.type === 'INSTALLATION' || ticket.type === 'MAINTENANCE'
  const canCancel = ticket.status !== 'CLOSED'

  return (
    <div className="flex flex-col gap-5">
      <Link to="/tickets" className="text-sm font-semibold text-charcoal hover:underline">← Quay lại danh sách</Link>

      <Card size="lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>
              <Badge tone={STATUS_TONE[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
            </div>
            <h1 className="mt-2 text-xl font-bold text-charcoal">{TICKET_TYPE_LABEL[ticket.type]}</h1>
            <p className="mt-1 text-sm text-warmGray">Tạo lúc {formatDate(ticket.created_at)}</p>
          </div>
          {canCancel && (
            <Button variant="danger" size="sm" onClick={() => setShowCancel(true)}>Hủy ticket</Button>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-warmGray/10 pt-4 text-sm sm:grid-cols-4">
          <InfoItem label="Kỹ thuật viên phụ trách" value={assigneeName(ticket.assigned_to) ?? 'Chưa gán'} />
          {ticket.scheduled_visit_at && <InfoItem label="Ngày hẹn" value={formatDate(ticket.scheduled_visit_at)} />}
          {ticket.sla_resolve_due_at && <InfoItem label="Hạn xử lý (SLA)" value={formatDate(ticket.sla_resolve_due_at)} />}
          {ticket.is_sla_breached && <InfoItem label="Trạng thái SLA" value="Đã vượt hạn" warn />}
        </dl>
      </Card>

      {isInstallation && (
        <Card>
          <p className="label-caption mb-3">Checklist nghiệm thu (Technician xác nhận)</p>
          <div className="flex flex-col gap-2">
            {Object.entries(SAT_LABEL).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2.5 text-sm">
                <span className={cnDot(ticket.sat_checklist[key as keyof typeof SAT_LABEL])} />
                <span className={ticket.sat_checklist[key as keyof typeof SAT_LABEL] ? 'text-charcoal' : 'text-warmGray'}>{label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <NotesTimeline ticketId={ticket._id} notes={ticket.notes} />

      {ticket.status === 'CLOSED' && (
        <RatingCard ticketId={ticket._id} existingRating={ticket.satisfaction_rating} />
      )}

      <CancelTicketModal open={showCancel} onClose={() => setShowCancel(false)} ticketId={ticket._id} />
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

  if (existingRating) {
    return (
      <Card>
        <p className="label-caption mb-2">Bạn đã đánh giá</p>
        <StarRating value={existingRating} readOnly />
      </Card>
    )
  }

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
  const [reason, setReason] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    cancelTicket.mutate({ id: ticketId, reason }, {
      onSuccess: () => { push('Đã hủy ticket'); setReason(''); onClose() },
      onError: (err) => push(getApiErrorMessage(err, 'Hủy ticket thất bại'), 'error'),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Hủy ticket">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Textarea
          label="Lý do hủy" required
          placeholder="VD: Đã tự khắc phục được, không cần lắp nữa..."
          value={reason} onChange={e => setReason(e.target.value)}
        />
        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Đóng</Button>
          <Button type="submit" variant="danger" className="flex-1" loading={cancelTicket.isPending}>Hủy ticket</Button>
        </div>
      </form>
    </Modal>
  )
}
