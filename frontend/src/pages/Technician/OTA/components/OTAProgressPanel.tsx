// OTAProgressPanel.tsx — 5-step progress display với progress bar animation
import type { OTAStepState } from './otaTypes'

interface Props {
  steps: OTAStepState[]
  done: boolean
  firmware: string
}

export function OTAProgressPanel({ steps, done, firmware }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {done && (
        <div className="flex items-center gap-2 rounded-xl border border-limeMist/30 bg-limeMist/15 px-4 py-3">
          <span className="text-xl">✅</span>
          <div>
            <p className="font-semibold text-charcoal">Cập nhật thành công!</p>
            <p className="text-sm text-charcoal/70">Firmware {firmware} đang chạy</p>
          </div>
        </div>
      )}
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            step.status === 'done'   ? 'bg-charcoal text-white' :
            step.status === 'active' ? 'bg-limeMist text-charcoal ring-1 ring-charcoal' :
                                       'bg-graphite/15 text-warmGray'
          }`}>
            {step.status === 'done' ? '✓' : i + 1}
          </span>
          <div className="flex-1">
            <p className={`text-sm ${step.status === 'pending' ? 'text-warmGray' : 'font-medium text-charcoal'}`}>
              {step.label}
            </p>
            {step.status === 'active' && step.progress !== undefined && (
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-graphite/15">
                <div
                  className="h-full rounded-full bg-charcoal transition-all duration-300"
                  style={{ width: `${step.progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
