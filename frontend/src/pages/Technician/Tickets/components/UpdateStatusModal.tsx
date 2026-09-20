// UpdateStatusModal.tsx — B1: Cập nhật trạng thái Ticket
// Dùng chung: TechnicianTicketsPage + TechnicianTicketDetailPage
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketApi } from '@/services/api/tickets'
import { Button, Modal, Textarea } from '@/components/ui'
import { useToastStore } from '@/store/toastStore'
import { getApiErrorMessage } from '@/utils/helpers'
import { STATUS_LABEL } from '@/constants/tickets'
import type { Ticket, TicketStatus } from '@/types'

const STATUS_OPTIONS: { value: TicketStatus; label: string; desc: string }[] = [
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
  const [selected, setSelected] = useState<TicketStatus>(
    ticket.status === 'NEW' ? 'IN_PROGRESS' : ticket.status,
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

  return (
    <Modal open onClose={onClose} title="Cập nhật trạng thái Ticket">
      <div className="flex flex-col gap-4">
        {STATUS_OPTIONS.map(opt => (
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
        ))}

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
            disabled={needNote && !note.trim()}
            className="flex-1"
          >
            Xác nhận cập nhật
          </Button>
        </div>
      </div>
    </Modal>
  )
}
