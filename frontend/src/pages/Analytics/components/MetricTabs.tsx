import { cn } from '@/utils/cn'
import { METRICS, type MetricKey } from '../constants'

export default function MetricTabs({ metric, onChange }: { metric: MetricKey; onChange: (m: MetricKey) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {METRICS.map(m => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
            metric === m.key ? 'bg-charcoal text-white' : 'bg-warmGray/10 text-warmGray hover:bg-warmGray/20',
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
