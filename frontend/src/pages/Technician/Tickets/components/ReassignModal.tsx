// ReassignModal.tsx — B2: Yêu cầu gán lại Ticket
// Dùng chung: TechnicianTicketsPage + TechnicianTicketDetailPage
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ticketApi } from '@/services/api/tickets'
import { Button, Modal, Textarea } from '@/components/ui'
import { useToastStore } from '@/store/toastStore'
import { getApiErrorMessage } from '@/utils/helpers'
import type { Ticket } from '@/types'

interface Props {
  ticket: Ticket
  onClose: () => void
}

export function ReassignModal({ ticket, onClose }: Props) {
  const push = useToastStore(s => s.push)
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')

  const mut = useMutation({
    mutationFn: () => ticketApi.escalate(ticket._id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      push('Yêu cầu gán lại đã được gửi')
      onClose()
    },
    onError: (err) => push(getApiErrorMessage(err, 'Gửi yêu cầu thất bại'), 'error'),
  })

  const isValid = reason.trim().length >= 10

  return (
    <Modal open onClose={onClose} title="Yêu cầu gán lại Ticket">
      <div className="flex flex-col gap-4">
        <Textarea
          label="Lý do yêu cầu gán lại"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Mô tả lý do bạn không thể xử lý ticket này (tối thiểu 10 ký tự)..."
          rows={4}
        />
        <p className={`-mt-2 text-right text-xs ${reason.length < 10 ? 'text-climateOrange' : 'text-warmGray'}`}>
          {reason.length}/200
        </p>

        <div className="rounded-xl border border-climateOrange/30 bg-climateOrange/8 px-4 py-3">
          <p className="text-sm text-climateOrange">
            ⚠️ Ticket Router sẽ tự động phân công lại cho kỹ thuật viên khác trong khu vực.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Huỷ</Button>
          <Button
            onClick={() => mut.mutate()}
            loading={mut.isPending}
            disabled={!isValid}
            className="flex-1"
          >
            Gửi yêu cầu gán lại
          </Button>
        </div>
      </div>
    </Modal>
  )
}
