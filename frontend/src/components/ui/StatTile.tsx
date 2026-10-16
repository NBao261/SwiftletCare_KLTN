import type { Icon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import { tr } from '@/i18n'

interface StatTileProps {
  icon: Icon
  /** Màu vòng tròn icon — nơi duy nhất mang màu của ô (VD cùng màu badge trạng thái trong bảng) */
  iconClass: string
  label: string
  value: string | number
  sub: string
  className?: string
  /** Nhãn nền đỏ cùng hàng số lớn, sát mép phải (VD "115 quá hạn" ở ô Ticket đang mở) */
  valueBadge?: string
  /**
   * Làm nổi cả ô khi số đang báo vấn đề (nơi gọi tự quyết, VD > 0): `warning` cam / `critical` đỏ — viền + nền nhạt,
   * số + icon mang màu. Cùng kiểu ô "vượt ngưỡng" ReadingTile của Farm Owner. Không truyền = ô trắng bình thường
   */
  tone?: 'warning' | 'critical'
  /** Cách gọi cũ của các trang Technician (develop) — `alert` = `tone="critical"` */
  alert?: boolean
}

const TONE_CLASS = {
  warning: { box: 'border-climateOrange/40 bg-climateOrange/[0.06]', value: 'text-climateOrange', icon: 'bg-climateOrange text-white' },
  critical: { box: 'border-alertRed/40 bg-alertRed/[0.06]', value: 'text-alertRed', icon: 'bg-alertRed text-white' },
} as const

/**
 * Ô chỉ số ở hàng KPI các trang Admin — cùng kiểu ReadingTile ở Dashboard Farm Owner (EnvSensorPanel):
 * nền trắng, nhãn trái + icon tròn phải, số lớn, 1 dòng phụ. Mọi ô cùng tầng nên các tầng thẳng hàng
 * ngang giữa các ô.
 */
export default function StatTile({ icon: TileIcon, iconClass, label, value, sub, className, valueBadge, tone: toneProp, alert }: StatTileProps) {
  const tone = toneProp ?? (alert ? 'critical' : undefined)
  // Mặc định không tô màu ô — tốt/xấu ghi bằng chữ ở dòng phụ; chỉ tô khi nơi gọi truyền `tone`
  const toneClass = tone ? TONE_CLASS[tone] : undefined
  return (
    <div className={cn('flex flex-col rounded-2xl border border-warmGray/15 bg-white p-3.5 shadow-card', className, toneClass?.box)}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        {/* Xuống dòng thay vì cắt "…" — ô hẹp (mobile 2×2) vẫn đọc đủ nhãn */}
        <span className="min-w-0 text-small font-semibold text-warmGray">{tr(label)}</span>
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', iconClass, toneClass?.icon)}>
          {/* Nét regular cho gần nét mảnh (stroke 1.6) của icon ReadingTile ở Dashboard Farm Owner */}
          <TileIcon size={14} weight="regular" />
        </span>
      </div>
      {/* Nhãn đỏ cùng hàng số, dạt sát phải; flex-wrap: ô quá hẹp thì nhãn xuống dòng thay vì tràn khỏi ô */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        {/* Cỡ chữ gọn: nhãn 13px · số 24px · dòng phụ 12px */}
        <p className={cn('text-2xl font-extrabold leading-none tracking-tight text-charcoal', toneClass?.value)}>
          {tr(value)}
        </p>
        {valueBadge && (
          <span className="whitespace-nowrap rounded-full bg-alertRed px-2 py-0.5 text-xs font-semibold text-white">
            {tr(valueBadge)}
          </span>
        )}
      </div>
      {/* Dòng phụ xuống dòng khi ô hẹp thay vì cắt "…" — grid kéo các ô cùng hàng cao bằng nhau */}
      <p className="mt-1.5 text-xs font-medium text-warmGray">{tr(sub)}</p>
    </div>
  )
}
