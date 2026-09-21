// ReassignModal.tsx — B2: Yêu cầu gán lại Ticket
// Fix: Disable khi ticket CLOSED
// Fix: Gắn nhãn TODO [BE-GAP] — API escalate KHÔNG gán lại ai, chỉ set is_sla_breached=true.
//      Chức năng reassign thật chưa có endpoint, dùng tạm escalate để ghi nhận yêu cầu.
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

  const isClosed = ticket.status === 'CLOSED'

  // TODO [BE-GAP]: ticketApi.escalate đặt is_sla_breached=true + thêm note,
  // KHÔNG gán lại Technician. Cần endpoint riêng POST /tickets/:id/reassign-request
  // khi backend có. Hiện tại: ghi nhận yêu cầu qua note, Admin/Dispatcher xử lý thủ công.
  //
  // ⚠️  Tác động thật: gọi API này sẽ đánh dấu ticket này vi phạm SLA trên hệ thống.
  const mut = useMutation({
    mutationFn: () => ticketApi.escalate(ticket._id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      push('Đã báo cáo — Admin sẽ phân công lại thủ công')
      onClose()
    },
    onError: (err) => push(getApiErrorMessage(err, 'Gửi báo cáo thất bại'), 'error'),
  })

  const isValid = reason.trim().length >= 10

  return (
    <Modal open onClose={onClose} title="Yêu cầu gán lại Ticket">
      <div className="flex flex-col gap-4">
        {/* Cảnh báo nếu ticket đã CLOSED */}
        {isClosed && (
          <div className="rounded-xl border border-alertRed/20 bg-alertRed/[0.08] px-4 py-3">
            <p className="text-sm font-semibold text-alertRed">
              ⚠️ Ticket đã đóng — không thể yêu cầu gán lại
            </p>
          </div>
        )}

        <Textarea
          label="Lý do yêu cầu gán lại"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Mô tả lý do bạn không thể xử lý ticket này (tối thiểu 10 ký tự)..."
          rows={4}
          disabled={isClosed}
        />
        <p className={`-mt-2 text-right text-xs ${reason.length < 10 ? 'text-climateOrange' : 'text-warmGray'}`}>
          {reason.length}/200
        </p>

        {!isClosed && (
          <div className="rounded-xl border border-alertRed/30 bg-alertRed/[0.06] px-4 py-3">
            <p className="text-sm font-semibold text-alertRed">
              ⚠️ Lưu ý quan trọng — Tác động thật đến hệ thống
            </p>
            <ul className="mt-1.5 flex flex-col gap-1 text-xs text-alertRed/80">
              <li>• Hành động này sẽ <strong>đánh dấu ticket vi phạm SLA</strong> trên hệ thống ngay lập tức</li>
              <li>• Admin hoặc Dispatcher sẽ phân công lại thủ công sau khi nhận yêu cầu</li>
              <li>• Chỉ dùng khi thật sự không thể xử lý ticket này</li>
            </ul>
            <p className="mt-2 text-[11px] text-warmGray">
              {/* TODO [BE-GAP]: Khi có endpoint reassign thật, thay bằng phân công tự động */}
              Phân công tự động sẽ khả dụng khi backend có endpoint reassign.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Huỷ</Button>
          <Button
            onClick={() => mut.mutate()}
            loading={mut.isPending}
            disabled={!isValid || isClosed}
            className="flex-1"
          >
            Báo cáo không thể xử lý
          </Button>
        </div>
      </div>
    </Modal>
  )
}
