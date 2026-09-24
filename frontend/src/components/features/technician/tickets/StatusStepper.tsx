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
    <div className="relative flex w-full items-start justify-between py-2 sm:px-2">
      {/* Background line */}
      <div className="absolute left-[12.5%] right-[12.5%] top-6 h-0.5 -translate-y-1/2 rounded-full bg-graphite/15" />
      
      {/* Active line */}
      <div 
        className="absolute left-[12.5%] top-6 h-0.5 -translate-y-1/2 rounded-full bg-charcoal transition-all duration-500 ease-in-out"
        style={{ width: `${(currentIdx / (STEPS.length - 1)) * 75}%` }}
      />

      {STEPS.map((step, i) => {
        const done   = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={step.status} className="relative z-10 flex w-1/4 flex-col items-center gap-2">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
              done   ? 'bg-charcoal text-white shadow-sm ring-4 ring-white' :
              active ? 'bg-limeMist text-charcoal shadow-sm ring-4 ring-white' :
                       'bg-white text-warmGray ring-2 ring-graphite/15 ring-offset-2 ring-offset-white'
            }`}>
              {done ? '✓' : i + 1}
            </div>
            <span className={`text-center text-[10px] sm:text-[11px] font-semibold tracking-wide ${active ? 'text-charcoal' : 'text-warmGray'}`}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
