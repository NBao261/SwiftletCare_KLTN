// UpdateStatusModal.tsx — B1: Cập nhật trạng thái Ticket
// Dùng chung: TechnicianTicketsPage + TechnicianTicketDetailPage
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketApi } from '@/apis/shared/tickets.api'
import { Button, Modal, Textarea } from '@/components/ui'
import { useToastStore } from '@/stores/toastStore'
import { getApiErrorMessage } from '@/lib/helpers'
import { STATUS_LABEL } from '@/constants/tickets'
import type { Ticket, TicketStatus } from '@/types'

// Trạng thái hợp lệ có thể chuyển tới từ trạng thái hiện tại (State Machine)
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW:                        ['IN_PROGRESS'],
  IN_PROGRESS:               ['AWAITING_FIELD_CONFIRMATION', 'CLOSED'],
  AWAITING_FIELD_CONFIRMATION: ['CLOSED'],
  CLOSED:                    [], // Không cho cập nhật tiếp
}

const ALL_STATUS_OPTIONS: { value: TicketStatus; label: string; desc: string }[] = [
  {
    value: 'IN_PROGRESS',
    label: 'Đang xử lý',
    desc: 'Bắt đầu xử lý sự cố tại hiện trường',
  },
  {
    value: 'AWAITING_FIELD_CONFIRMATION',
    label: 'Chờ xác nhận hiện trường',
    desc: 'Đã hoàn thành, chờ Farm Owner xác nhận',
  },
  {
    value: 'CLOSED',
    label: 'Đã đóng',
    desc: 'Ticket hoàn tất (yêu cầu ghi chú bắt buộc)',
  },
]

interface Props {
  ticket: Ticket
  onClose: () => void
}

export function UpdateStatusModal({ ticket, onClose }: Props) {
  const push = useToastStore(s => s.push)
  const queryClient = useQueryClient()

  // Chỉ hiện các status hợp lệ theo State Machine
  const STATUS_OPTIONS = ALL_STATUS_OPTIONS.filter(
    opt => ALLOWED_TRANSITIONS[ticket.status].includes(opt.value),
  )

  // Nếu ticket đã CLOSED — không cho update
  const isClosed = ticket.status === 'CLOSED'

  const [selected, setSelected] = useState<TicketStatus>(
    STATUS_OPTIONS[0]?.value ?? ticket.status,
  )
  const [note, setNote] = useState('')

  const mut = useMutation({
    mutationFn: () => ticketApi.updateStatus(ticket._id, selected, note || undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      push(`Trạng thái: ${STATUS_LABEL[selected]}`)
      onClose()
    },
    onError: (err) => push(getApiErrorMessage(err, 'Cập nhật thất bại'), 'error'),
  })

  const needNote = selected === 'CLOSED'

  // Ticket đã đóng — không thể cập nhật
  if (isClosed) {
    return (
      <Modal open onClose={onClose} title="Cập nhật trạng thái Ticket">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span className="text-4xl">🔒</span>
          <p className="font-semibold text-charcoal">Ticket này đã được đóng</p>
          <p className="text-sm text-warmGray">Không thể cập nhật trạng thái của ticket đã đóng.</p>
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} title="Cập nhật trạng thái Ticket">
      <div className="flex flex-col gap-4">
        {STATUS_OPTIONS.length === 0 ? (
          <p className="text-center text-sm text-warmGray py-4">Không có trạng thái nào khả dụng.</p>
        ) : (
          STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                selected === opt.value
                  ? 'border-charcoal bg-charcoal/5'
                  : 'border-graphite/20 hover:border-graphite/40'
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected === opt.value ? 'border-charcoal bg-charcoal' : 'border-graphite/40'
                }`}
              >
                {selected === opt.value && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <div>
                <p className="font-semibold text-charcoal">{opt.label}</p>
                <p className="text-sm text-warmGray">{opt.desc}</p>
              </div>
            </button>
          ))
        )}

        <Textarea
          label={needNote ? 'Ghi chú (bắt buộc khi đóng ticket)' : 'Ghi chú (tùy chọn)'}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Mô tả tình trạng xử lý, hướng giải quyết..."
          rows={3}
        />

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Huỷ</Button>
          <Button
            onClick={() => mut.mutate()}
            loading={mut.isPending}
            disabled={(needNote && !note.trim()) || STATUS_OPTIONS.length === 0}
            className="flex-1"
          >
            Xác nhận cập nhật
          </Button>
        </div>
      </div>
    </Modal>
  )
}
