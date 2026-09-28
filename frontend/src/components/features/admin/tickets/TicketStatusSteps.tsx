import { CheckIcon } from '@phosphor-icons/react'
import { STATUS_LABEL } from '@/constants/tickets'
import { cn } from '@/lib/cn'
import type { TicketStatus } from '@/types'

const STEPS = Object.keys(STATUS_LABEL) as TicketStatus[]

/**
 * Tiến trình 4 bước của ticket (ALLOWED_TRANSITIONS ở ticket.service.ts): Mới → Đang xử lý → Chờ xác nhận
 * hiện trường → Đã đóng. Đã đóng thì tô hết — kể cả ticket huỷ/đóng thẳng từ Mới, vì chỉ cần biết đã tới bước cuối.
 * Bước đã qua charcoal + dấu tích, bước hiện tại lime, bước sau xám.
 */
export default function TicketStatusSteps({ status }: { status: TicketStatus }) {
  const current = STEPS.indexOf(status)
  const closed = status === 'CLOSED'

  return (
    <ol className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
      {STEPS.map((s, i) => {
        const done = closed || i < current
        const active = !closed && i === current
        return (
          <li key={s} className="flex min-w-0 flex-col gap-2" aria-current={active ? 'step' : undefined}>
            <div className={cn('h-1.5 rounded-full', done ? 'bg-charcoal' : active ? 'bg-accent-300' : 'bg-warmGray/15')} />
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-caption',
                  done ? 'bg-charcoal text-limeMist' : active ? 'bg-accent-300 text-charcoal' : 'bg-warmGray/15 text-warmGray',
                )}
              >
                {done ? <CheckIcon size={11} weight="bold" /> : i + 1}
              </span>
              <span title={STATUS_LABEL[s]} className={cn('truncate text-small', done || active ? 'font-semibold text-charcoal' : 'text-warmGray')}>
                {STATUS_LABEL[s]}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
