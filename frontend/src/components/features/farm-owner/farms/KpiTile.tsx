import type { ReactNode } from 'react'
import type { Icon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'

type KpiTone = 'neutral' | 'orange'

const TONE_CLASS: Record<KpiTone, string> = {
  neutral: 'bg-warmGray/10 text-charcoal',
  orange: 'bg-safetyOrange/15 text-safetyOrange',
}

interface KpiTileProps {
  icon: Icon
  label: string
  value: string | number
  unit?: string
  sub: string
  /** Màu vòng tròn icon (không tô cả ô): neutral xám · orange = có cảnh báo */
  tone?: KpiTone
  /** Huy hiệu nhỏ cạnh số chính (VD so sánh với kỳ trước) — không truyền thì ô giữ nguyên như cũ */
  badge?: ReactNode
}

/** Ô chỉ số cùng kích thước ReadingTile ở EnvSensorPanel (Dashboard): p-4, icon tròn 28px, số text-2xl, dòng phụ cao 16px */
export default function KpiTile({ icon: TileIcon, label, value, unit, sub, tone = 'neutral', badge }: KpiTileProps) {
  return (
    <div className="rounded-2xl border border-warmGray/15 bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="label-caption truncate">{label}</span>
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
            TONE_CLASS[tone],
          )}
        >
          <TileIcon size={14} weight="bold" />
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="text-2xl font-extrabold leading-none tracking-tight text-charcoal">
          {value}
          {unit && <span className="ml-1 text-xs font-medium text-warmGray">{unit}</span>}
        </div>
        {badge}
      </div>

      <p className="mt-1.5 h-4 truncate text-caption font-medium tracking-normal text-warmGray" title={sub}>{sub}</p>
    </div>
  )
}
