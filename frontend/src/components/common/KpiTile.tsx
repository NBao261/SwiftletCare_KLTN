import type { ReactNode } from 'react'
import type { Icon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import { tr } from '@/i18n'

// Màu ô: neutral/orange/green chỉ tô vòng icon, warning/critical tô cả ô khi số đang báo vấn đề
type KpiTone = 'neutral' | 'orange' | 'green' | 'warning' | 'critical'

const ICON_TONE_CLASS: Record<KpiTone, string> = {
  neutral: 'bg-warmGray/10 text-charcoal',
  orange: 'bg-safetyOrange/15 text-safetyOrange',
  green: 'bg-accent-100 text-accent-700',
  warning: 'bg-climateOrange text-white',
  critical: 'bg-alertRed text-white',
}

const BOX_TONE_CLASS: Partial<Record<KpiTone, { box: string; value: string }>> = {
  warning: { box: 'border-climateOrange/40 bg-climateOrange/[0.06]', value: 'text-climateOrange' },
  critical: { box: 'border-alertRed/40 bg-alertRed/[0.06]', value: 'text-alertRed' },
}

interface KpiTileProps {
  icon: Icon
  label: string
  value: string | number
  unit?: string
  sub: string
  tone?: KpiTone
  // Màu vòng icon riêng (VD cùng màu badge trạng thái trong bảng), thay màu theo tone
  iconClass?: string
  // Huy hiệu nhỏ cạnh số chính (VD so sánh với kỳ trước)
  badge?: ReactNode
  // Nhãn nền đỏ cùng hàng số, sát mép phải (VD "3 quá hạn")
  valueBadge?: string
  // Cách gọi cũ: alert = tone critical
  alert?: boolean
  className?: string
}

// Ô chỉ số dùng chung cho hàng KPI của 4 role (C-10, FE_Design §1.1)
export default function KpiTile({ icon: TileIcon, label, value, unit, sub, tone: toneProp, iconClass, badge, valueBadge, alert, className }: KpiTileProps) {
  const tone = toneProp ?? (alert ? 'critical' : 'neutral')
  const boxTone = BOX_TONE_CLASS[tone]
  return (
    <div className={cn('flex flex-col rounded-2xl border border-warmGray/15 bg-white p-4 shadow-card', boxTone?.box, className)}>
      <div className="mb-2 flex items-start justify-between gap-2">
        {/* Xuống dòng thay vì cắt "…" — ô hẹp (điện thoại 2×2) vẫn đọc đủ nhãn */}
        <span className="label-caption min-w-0">{tr(label)}</span>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', iconClass ?? ICON_TONE_CLASS[tone], boxTone && ICON_TONE_CLASS[tone])}>
          <TileIcon size={14} weight="bold" />
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn('text-2xl font-extrabold leading-none tracking-tight text-charcoal tabular-nums', boxTone?.value)}>
            {tr(value)}
            {unit && <span className="ml-1 text-small font-medium text-warmGray">{unit}</span>}
          </p>
          {badge}
        </div>
        {valueBadge && (
          <span className="whitespace-nowrap rounded-full bg-alertRed px-2 py-0.5 text-small font-semibold text-white">{tr(valueBadge)}</span>
        )}
      </div>

      <p className="mt-1.5 text-small font-medium text-warmGray">{tr(sub)}</p>
    </div>
  )
}
