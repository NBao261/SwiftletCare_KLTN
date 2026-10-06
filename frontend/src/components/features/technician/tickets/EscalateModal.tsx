import { useEscalateTicket } from '@/hooks/shared/useTickets'
import { useToastStore } from '@/stores/toastStore'
import NoteActionModal from '@/components/ui/NoteActionModal'
import { getApiErrorMessage } from '@/lib/helpers'

export function EscalateModal({ open, onClose, ticketId }: { open: boolean; onClose: () => void; ticketId: string }) {
  const escalate = useEscalateTicket()
  const push = useToastStore(s => s.push)
  return (
    <NoteActionModal
      open={open}
      onClose={onClose}
      title="Báo Admin hỗ trợ"
      label="Lý do cần Admin hỗ trợ"
      placeholder="VD: Cần vật tư, không liên lạc được chủ trại, vượt khả năng xử lý..."
      submitLabel="Gửi báo cáo"
      loading={escalate.isPending}
      onSubmit={(reason) => {
        escalate.mutate({ id: ticketId, reason: reason || undefined }, {
          onSuccess: () => { push('Đã báo Admin'); onClose() },
          onError: (err) => push(getApiErrorMessage(err, 'Báo Admin thất bại'), 'error'),
        })
      }}
    />
  )
}
