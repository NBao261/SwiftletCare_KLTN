// StatusStepper.tsx — 4 bước trạng thái ticket (dùng Stepper chung)
import Stepper from '@/components/ui/Stepper'
import type { TicketStatus } from '@/types'

const STEPS: { status: TicketStatus; label: string }[] = [
  { status: 'NEW',                         label: 'Mới' },
  { status: 'IN_PROGRESS',                 label: 'Đang xử lý' },
  { status: 'AWAITING_FIELD_CONFIRMATION', label: 'Chờ xác nhận' },
  { status: 'CLOSED',                      label: 'Đã đóng' },
]

interface Props {
  current: TicketStatus
}

export function StatusStepper({ current }: Props) {
  const currentIdx = STEPS.findIndex(s => s.status === current)
  // Ticket đã đóng = quy trình hoàn tất → mọi bước hiện dấu ✓
  return <Stepper steps={STEPS.map(s => s.label)} current={currentIdx} completed={current === 'CLOSED'} />
}
