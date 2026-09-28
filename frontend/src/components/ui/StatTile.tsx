import type { Icon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'

interface StatTileProps {
  icon: Icon
  /** Màu vòng tròn icon — nơi duy nhất mang màu của ô (VD cùng màu badge trạng thái trong bảng) */
  iconClass: string
  /** Tô cả ô đỏ nhạt + số đỏ, như ô vượt ngưỡng ở Dashboard */
  alert?: boolean
  label: string
  value: string | number
  sub: string
  className?: string
  /** Chip nhỏ cạnh icon (VD "3 vi phạm SLA") — `chipClass` quyết định màu */
  chip?: string
  chipClass?: string
  /** 0–100: vẽ thanh tiến độ mảnh dưới số (VD % thiết bị online) */
  progress?: number
}

/**
 * Ô chỉ số ở hàng KPI đầu các trang Admin (Ticket, Người dùng) — cùng kiểu ReadingTile ở Dashboard
 * Farm Owner (EnvSensorPanel): nền trắng, nhãn trái + icon tròn phải, số lớn, 1 dòng phụ. Mọi ô cùng
 * 4 tầng nên cao bằng nhau, các tầng thẳng hàng ngang giữa các ô.
 */
export default function StatTile({ icon: TileIcon, iconClass, alert, label, value, sub, className, chip, chipClass, progress }: StatTileProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border p-4 shadow-card',
        alert ? 'border-alertRed/40 bg-alertRed/[0.06]' : 'border-warmGray/15 bg-white',
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="label-caption truncate">{label}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {chip && <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-caption', chipClass ?? 'bg-warmGray/10 text-graphite')}>{chip}</span>}
          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', iconClass)}>
            <TileIcon size={14} weight="bold" />
          </span>
        </div>
      </div>
      <p className={cn('text-h1 font-extrabold leading-none tracking-tight tabular-nums', alert ? 'text-alertRed' : 'text-charcoal')}>
        {value}
      </p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-warmGray/15" role="presentation">
          <div className={cn('h-full rounded-full', alert ? 'bg-alertRed' : 'bg-charcoal')} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      <p className="mt-1.5 truncate text-caption font-medium tabular-nums text-warmGray">{sub}</p>
    </div>
  )
}
