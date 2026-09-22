// TICKET-FR-005b — 3 modal can thiệp của Admin trên TechnicianTicketDetailPage, cùng gọi
// PUT /tickets/:id/admin-override (useAdminOverrideTicket). Mỗi modal bắt buộc
// "Lý do": backend ghi thành note "Admin can thiệp: ..." + audit TICKET_ADMIN_OVERRIDE.
import { useState, useEffect, FormEvent } from 'react'
import { useAdminOverrideTicket } from '@/hooks/shared/useTickets'
import { useTechniciansList } from '@/hooks/admin/useUsers'
import { useFarm } from '@/hooks/shared/useFarms'
import { Button, Modal, Select, Textarea } from '@/components/ui'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import type { Ticket, TicketPriority, User } from '@/types'

const PRIORITIES: TicketPriority[] = ['P1', 'P2', 'P3']
const REASON_PLACEHOLDER = 'VD: Farm Owner báo mất điện toàn khu, cần xử lý trong hôm nay...'

interface BaseProps { open: boolean; onClose: () => void; ticket: Ticket }

/** Ô lý do dùng chung 3 modal — required + báo lỗi sau khi bấm submit */
function ReasonField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Textarea
      label="Lý do can thiệp"
      required
      rows={2}
      placeholder={REASON_PLACEHOLDER}
      value={value}
      onChange={e => onChange(e.target.value)}
      error={error}
    />
  )
}

const REASON_EMPTY = 'Chưa nhập lý do — lý do được ghi vào lịch sử ticket và nhật ký hệ thống'

// ── Đổi độ ưu tiên ────────────────────────────────────────────────────────────

export function ChangePriorityModal({ open, onClose, ticket }: BaseProps) {
  const override = useAdminOverrideTicket()
  const push = useToastStore(s => s.push)
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority)
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  // Modal không unmount giữa các lần mở — reset về giá trị hiện tại của ticket mỗi lần mở
  useEffect(() => {
    if (open) { setPriority(ticket.priority); setReason(''); setSubmitted(false) }
  }, [open, ticket.priority])

  const reasonError = submitted && !reason.trim() ? REASON_EMPTY : undefined
  const unchanged = priority === ticket.priority

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!reason.trim() || unchanged) return
    override.mutate({ id: ticket._id, priority, reason: reason.trim() }, {
      onSuccess: () => { push('Đã đổi độ ưu tiên — hạn SLA tính lại theo mức mới'); onClose() },
      onError: (err) => push(getApiErrorMessage(err, 'Đổi độ ưu tiên thất bại'), 'error'),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Đổi độ ưu tiên">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Select label="Độ ưu tiên" value={priority} onChange={e => setPriority(e.target.value as TicketPriority)}>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}{p === ticket.priority ? ' (hiện tại)' : ''}</option>)}
        </Select>
        <ReasonField value={reason} onChange={setReason} error={reasonError} />
        <Button type="submit" loading={override.isPending} disabled={unchanged} className="w-full">Lưu</Button>
      </form>
    </Modal>
  )
}

// ── Gán lại kỹ thuật viên ─────────────────────────────────────────────────────

/** Backend từ chối gán ngoài vùng bằng 400 + câu gợi ý cố định "Gửi kèm force=true..." (ticket.service.ts) */
function isOutOfRegionError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status
  return status === 400 && getApiErrorMessage(err, '').includes('force=true')
}

function coversRegion(technician: User, farmRegion: string | undefined): boolean | undefined {
  if (!farmRegion) return undefined // farm chưa đặt region → không biết, để backend quyết
  return (technician.assigned_regions ?? []).includes(farmRegion)
}

export function ReassignTicketModal({ open, onClose, ticket }: BaseProps) {
  const { records: technicians, truncated, total, isLoading } = useTechniciansList()
  const { data: farm } = useFarm(ticket.farm_id)
  const override = useAdminOverrideTicket()
  const push = useToastStore(s => s.push)
  const [technicianId, setTechnicianId] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  /** Thông điệp cảnh báo ngoài vùng đang chờ Admin xác nhận "Vẫn gán" (force=true) */
  const [forceConfirm, setForceConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setTechnicianId(''); setReason(''); setSubmitted(false); setForceConfirm(null) }
  }, [open])

  const currentAssigneeId = typeof ticket.assigned_to === 'object' ? ticket.assigned_to._id : ticket.assigned_to
  const selected = technicians.find(t => t._id === technicianId)
  const reasonError = submitted && !reason.trim() ? REASON_EMPTY : undefined

  function send(force: boolean) {
    override.mutate({ id: ticket._id, assigned_to: technicianId, reason: reason.trim(), force: force || undefined }, {
      onSuccess: () => { push('Đã gán lại kỹ thuật viên'); onClose() },
      onError: (err) => {
        // Chưa force mà backend chặn vì ngoài vùng → hỏi lại thay vì chỉ báo lỗi
        if (!force && isOutOfRegionError(err)) setForceConfirm(`${selected?.full_name ?? 'Kỹ thuật viên này'} không phụ trách khu vực của farm (hoặc farm chưa được gán khu vực). Nếu vẫn gán, kỹ thuật viên này sẽ không tự mở được ticket cho đến khi được thêm vùng phụ trách.`)
        else push(getApiErrorMessage(err, 'Gán lại kỹ thuật viên thất bại'), 'error')
      },
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!selected || !reason.trim()) return
    // Biết trước là ngoài vùng (đã có region của farm) thì hỏi luôn, khỏi mất 1 vòng 400
    if (coversRegion(selected, farm?.region) === false) {
      const regions = selected.assigned_regions?.join(', ') || 'chưa gán vùng nào'
      setForceConfirm(`${selected.full_name} phụ trách ${regions}, không khớp khu vực "${farm?.region}" của farm. Nếu vẫn gán, kỹ thuật viên này sẽ không tự mở được ticket cho đến khi được thêm vùng phụ trách.`)
      return
    }
    send(false)
  }

  return (
    <>
      <Modal open={open && !forceConfirm} onClose={onClose} title="Gán lại kỹ thuật viên">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Select
            label="Kỹ thuật viên"
            required
            value={technicianId}
            onChange={e => setTechnicianId(e.target.value)}
            error={submitted && !technicianId ? 'Chưa chọn kỹ thuật viên' : undefined}
          >
            <option value="">{isLoading ? 'Đang tải...' : '-- Chọn kỹ thuật viên --'}</option>
            {technicians.map(t => {
              const outOfRegion = coversRegion(t, farm?.region) === false
              const regions = t.assigned_regions?.length ? ` (${t.assigned_regions.join(', ')})` : ''
              return (
                <option key={t._id} value={t._id} disabled={t._id === currentAssigneeId}>
                  {t.full_name}{regions}{t._id === currentAssigneeId ? ' — đang phụ trách' : outOfRegion ? ' — ngoài vùng' : ''}
                </option>
              )
            })}
          </Select>
          {farm?.region && <p className="-mt-2 text-xs text-warmGray">Khu vực của farm: {farm.region}</p>}
          {truncated && (
            <p className="-mt-2 text-xs text-climateOrange">
              Chỉ liệt kê {technicians.length}/{total} kỹ thuật viên đầu tiên (giới hạn 1 trang của /admin/users).
            </p>
          )}
          <ReasonField value={reason} onChange={setReason} error={reasonError} />
          <Button type="submit" loading={override.isPending} className="w-full">Gán lại</Button>
        </form>
      </Modal>

      <ConfirmModal
        open={open && !!forceConfirm}
        title="Kỹ thuật viên ngoài vùng phụ trách"
        description={forceConfirm ?? undefined}
        confirmLabel="Vẫn gán"
        danger
        loading={override.isPending}
        onConfirm={() => send(true)}
        onCancel={() => setForceConfirm(null)}
      />
    </>
  )
}

// ── Đổi lịch hẹn ──────────────────────────────────────────────────────────────

/**
 * ISO (UTC) → giá trị cho <input type="datetime-local"> theo giờ máy người dùng.
 * `iso.slice(0, 16)` cắt thẳng chuỗi UTC nên lệch 7 tiếng ở VN.
 */
function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function RescheduleModal({ open, onClose, ticket }: BaseProps) {
  const override = useAdminOverrideTicket()
  const push = useToastStore(s => s.push)
  const [scheduledAt, setScheduledAt] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (open) {
      setScheduledAt(ticket.scheduled_visit_at ? toLocalDateTimeInput(ticket.scheduled_visit_at) : '')
      setReason(''); setSubmitted(false)
    }
  }, [open, ticket.scheduled_visit_at])

  const reasonError = submitted && !reason.trim() ? REASON_EMPTY : undefined

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!scheduledAt || !reason.trim()) return
    override.mutate({ id: ticket._id, scheduled_visit_at: new Date(scheduledAt).toISOString(), reason: reason.trim() }, {
      onSuccess: () => { push('Đã đổi lịch hẹn'); onClose() },
      onError: (err) => push(getApiErrorMessage(err, 'Đổi lịch hẹn thất bại'), 'error'),
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="Đổi lịch hẹn">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reschedule-at" className="label-caption">
            Ngày giờ hẹn mới<span className="ml-0.5 text-alertRed" aria-hidden="true">*</span>
          </label>
          <input id="reschedule-at" type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="input" />
          {submitted && !scheduledAt && <span className="text-xs text-alertRed">Chưa chọn ngày giờ hẹn</span>}
        </div>
        <ReasonField value={reason} onChange={setReason} error={reasonError} />
        <Button type="submit" loading={override.isPending} className="w-full">Lưu</Button>
      </form>
    </Modal>
  )
}
