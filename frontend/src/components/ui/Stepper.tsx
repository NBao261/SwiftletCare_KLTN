// Stepper.tsx — stepper ngang dùng chung (Ticket: StatusStepper · Onboarding: WizardStepper).
// Trước đây 2 nơi copy-paste cùng 1 khối JSX; gộp lại để chỉnh giao diện/chuyển động 1 chỗ.
// Chuyển động: đường nối tô dần 500ms, bước hiện tại có vòng sáng (tắt khi prefers-reduced-motion).
import { cn } from '@/lib/cn'

interface StepperProps {
  steps: string[]
  /** Chỉ số bước hiện tại (0-based) */
  current: number
  /** true → mọi bước đều "xong" (VD ticket đã đóng): không còn bước active */
  completed?: boolean
  className?: string
}

export default function Stepper({ steps, current, completed = false, className }: StepperProps) {
  const count = steps.length
  // Đường nối chạy từ tâm bước đầu tới tâm bước cuối: mỗi cột rộng 100/count %
  const inset = 50 / count
  const span = 100 - inset * 2
  const activeIdx = completed ? count - 1 : current
  const fill = count > 1 ? (activeIdx / (count - 1)) * span : 0

  return (
    <div className={cn('relative flex w-full items-start justify-between py-2 sm:px-2', className)}>
      {/* Đường nền (z-0) */}
      <div
        aria-hidden
        className="absolute top-6 z-0 h-0.5 -translate-y-1/2 rounded-full bg-graphite/15"
        style={{ left: `${inset}%`, right: `${inset}%` }}
      />
      {/* Đường đã đi qua (z-0) */}
      <div
        aria-hidden
        className="absolute top-6 z-0 h-0.5 -translate-y-1/2 rounded-full bg-charcoal transition-[width] duration-500 ease-in-out motion-reduce:transition-none"
        style={{ left: `${inset}%`, width: `${fill}%` }}
      />

      {steps.map((label, i) => {
        const done = completed || i < current
        const active = !completed && i === current
        return (
          <div key={label} className="relative z-10 flex flex-col items-center gap-2" style={{ width: `${100 / count}%` }}>
            <div
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 motion-reduce:transition-none',
                done && 'bg-charcoal text-white shadow-sm ring-4 ring-white',
                active && 'animate-ring-glow bg-limeMist text-charcoal shadow-sm ring-4 ring-white motion-reduce:animate-none',
                !done && !active && 'bg-white text-warmGray ring-2 ring-graphite/15 ring-offset-2 ring-offset-white',
              )}
            >
              {done ? '✓' : i + 1}
            </div>
            <span className={cn('text-center text-[10px] font-semibold tracking-wide sm:text-[11px]', active ? 'text-charcoal' : 'text-warmGray')}>
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
