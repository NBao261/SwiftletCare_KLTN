import { useTelemetry } from '@/hooks/useTelemetry'
import { Badge } from '@/components/ui'
import type { AllZone } from '@/hooks/useFarms'

/**
 * 1 zone trong lưới tổng quan "Tất cả" (ZoneOverviewGrid) — tự gọi useTelemetry
 * riêng cho zone của mình để có Live status + 2 chỉ số chính (nhiệt độ, độ ẩm)
 * mà không cần thêm API/hook gộp: mỗi card là 1 instance độc lập của hook realtime
 * đã có sẵn (join/leave socket room riêng), xem useFarms.ts §useAllZones.
 */
export default function ZoneOverviewCard({ zone, onClick }: { zone: AllZone; onClick: () => void }) {
  const { data, isLive, hasEverReceived } = useTelemetry(zone._id)

  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-3 rounded-2xl border border-warmGray/15 bg-white p-4 text-left shadow-card transition-shadow hover:shadow-dock"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-charcoal">{zone.name}</p>
          <p className="truncate text-xs text-warmGray">{zone.farmName} · {zone.houseName}</p>
        </div>
        <Badge tone={isLive ? 'positive' : hasEverReceived ? 'critical' : 'neutral'}>
          <span
            className={
              isLive
                ? 'h-1.5 w-1.5 rounded-full bg-charcoal'
                : hasEverReceived
                  ? 'h-1.5 w-1.5 rounded-full bg-alertRed'
                  : 'h-1.5 w-1.5 rounded-full bg-warmGray'
            }
          />
          {isLive ? 'Live' : hasEverReceived ? 'Mất kết nối' : 'Chưa có dữ liệu'}
        </Badge>
      </div>

      <div className="flex items-center gap-4">
        <div>
          <p className="text-lg font-extrabold text-charcoal">
            {data.temperature !== undefined ? data.temperature.toFixed(1) : '--'}
            <span className="ml-0.5 text-xs font-medium text-warmGray">°C</span>
          </p>
          <p className="text-[11px] text-warmGray">Nhiệt độ</p>
        </div>
        <div>
          <p className="text-lg font-extrabold text-charcoal">
            {data.humidity !== undefined ? data.humidity.toFixed(1) : '--'}
            <span className="ml-0.5 text-xs font-medium text-warmGray">%</span>
          </p>
          <p className="text-[11px] text-warmGray">Độ ẩm</p>
        </div>
      </div>
    </button>
  )
}
