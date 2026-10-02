import { useState, useEffect, FormEvent } from 'react'
import { useAdminOverrideTicket } from '@/hooks/shared/useTickets'
import { Button, Modal, SelectMenu } from '@/components/ui'
import Field from '@/components/features/admin/tickets/SelectField'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { PRIORITY_LABEL } from '@/constants/sla'
import OverrideReasonField, { REASON_EMPTY, type OverrideModalProps } from '@/components/features/admin/tickets/OverrideReasonField'
import type { TicketPriority } from '@/types'

const PRIORITIES: TicketPriority[] = ['P1', 'P2', 'P3']

/** TICKET-FR-005b — Admin đổi độ ưu tiên; backend tính lại hạn SLA theo mức mới */
export default function ChangePriorityModal({ open, onClose, ticket }: OverrideModalProps) {
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
        <Field label="Độ ưu tiên">
          <SelectMenu
            field
            ariaLabel="Độ ưu tiên"
            value={priority}
            onChange={setPriority}
            options={PRIORITIES.map(p => ({ value: p, label: `${p} · ${PRIORITY_LABEL[p]}${p === ticket.priority ? ' (hiện tại)' : ''}` }))}
          />
        </Field>
        <OverrideReasonField value={reason} onChange={setReason} error={reasonError} />
        <Button type="submit" loading={override.isPending} disabled={unchanged} className="w-full">Lưu</Button>
      </form>
    </Modal>
  )
}
