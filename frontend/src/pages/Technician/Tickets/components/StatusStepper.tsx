// StatusStepper.tsx — 4-step horizontal stepper for ticket status
import type { TicketStatus } from '@/types'

const STEPS: { status: TicketStatus; label: string }[] = [
  { status: 'NEW',                        label: 'Mới' },
  { status: 'IN_PROGRESS',               label: 'Đang xử lý' },
  { status: 'AWAITING_FIELD_CONFIRMATION', label: 'Chờ xác nhận' },
  { status: 'CLOSED',                    label: 'Đã đóng' },
]

const STATUS_ORDER: Record<TicketStatus, number> = {
  NEW: 0, IN_PROGRESS: 1, AWAITING_FIELD_CONFIRMATION: 2, CLOSED: 3,
}

interface Props {
  current: TicketStatus
}

export function StatusStepper({ current }: Props) {
  const currentIdx = STATUS_ORDER[current]
  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {STEPS.map((step, i) => {
        const done   = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={step.status} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                done   ? 'bg-charcoal text-white' :
                active ? 'bg-limeMist text-charcoal ring-2 ring-charcoal' :
                         'bg-graphite/15 text-warmGray'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-center text-[10px] font-semibold ${active ? 'text-charcoal' : 'text-warmGray'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 ${i < currentIdx ? 'bg-charcoal' : 'bg-graphite/20'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
