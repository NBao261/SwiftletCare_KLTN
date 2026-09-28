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
  /** Chip xám nhỏ cạnh icon (VD "12/15" thiết bị online) */
  chip?: string
  /** Nhãn nền đỏ cùng hàng số lớn, sát mép phải (VD "115 vi phạm" ở ô Ticket đang mở) */
  valueBadge?: string
  /** 0–100: vẽ thanh tiến độ mảnh dưới số (VD % thiết bị online) */
  progress?: number
}

/**
 * Ô chỉ số ở hàng KPI đầu các trang Admin (Ticket, Người dùng) — cùng kiểu ReadingTile ở Dashboard
 * Farm Owner (EnvSensorPanel): nền trắng, nhãn trái + icon tròn phải, số lớn, 1 dòng phụ. Mọi ô cùng
 * 4 tầng nên cao bằng nhau, các tầng thẳng hàng ngang giữa các ô.
 */
export default function StatTile({ icon: TileIcon, iconClass, alert, label, value, sub, className, chip, valueBadge, progress }: StatTileProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border p-4 shadow-card',
        // Cảnh báo: nền trắng đặc + lớp đỏ mờ phủ lên (gradient 1 màu = lớp background-image trên background-color) —
        // chỉ đỏ mờ thì ô trong suốt, lẫn màu nền xám của trang thành đỏ đục. Độ đậm viền/nền = ô "Tỷ lệ đúng SLA"
        // (SummaryBox danger) ở dashboard để 2 kiểu ô cảnh báo cùng màu
        alert ? 'border-alertRed/30 bg-white bg-gradient-to-b from-alertRed/[0.04] to-alertRed/[0.04]' : 'border-warmGray/15 bg-white',
        className,
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="label-caption truncate">{label}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {chip && <span className={'whitespace-nowrap rounded-full bg-warmGray/10 px-2 py-0.5 text-caption text-graphite'}>{chip}</span>}
          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', iconClass)}>
            <TileIcon size={14} weight="bold" />
          </span>
        </div>
      </div>
      {/* Nhãn đỏ cùng hàng số, dạt sát phải; flex-wrap: ô quá hẹp thì nhãn xuống dòng thay vì tràn khỏi ô */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className={cn('text-h1 font-extrabold leading-none tracking-tight tabular-nums', alert ? 'text-alertRed' : 'text-charcoal')}>
          {value}
        </p>
        {valueBadge && (
          <span className="whitespace-nowrap rounded-full bg-alertRed px-2 py-0.5 text-caption font-semibold text-white">
            {valueBadge}
          </span>
        )}
      </div>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-warmGray/15" role="presentation">
          <div className={cn('h-full rounded-full', alert ? 'bg-alertRed' : 'bg-charcoal')} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {/* Dòng phụ cắt "…" khi ô hẹp — title để rê chuột vẫn đọc được đủ */}
      <p className="mt-1.5 truncate text-caption font-medium tabular-nums text-warmGray" title={sub}>{sub}</p>
    </div>
  )
}
