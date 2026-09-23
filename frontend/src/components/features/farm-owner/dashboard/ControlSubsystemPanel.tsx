import { Droplets, Wind, Volume2, Flame } from 'lucide-react'
import { Button, Card, RadialGauge } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { ControlMode, RelayName, RelayStates } from '@/types'

const RELAY_ITEMS: Array<{ key: RelayName; label: string; icon: typeof Droplets }> = [
  { key: 'misting', label: 'Phun sương siêu âm', icon: Droplets },
  { key: 'ventilation', label: 'Thông gió đối lưu', icon: Wind },
  { key: 'speaker', label: 'Hệ âm thanh dẫn dụ', icon: Volume2 },
  { key: 'heating', label: 'Sưởi ấm', icon: Flame },
]

interface ControlSubsystemPanelProps {
  zoneName?: string
  relayStates?: RelayStates
  controlMode?: ControlMode
  /** Nhiệt độ đang VƯỢT trần ngưỡng — tô cảnh báo relay thoát nhiệt/thông gió (ENV-FR-004) */
  tooHot?: boolean
  /** Nhiệt độ đang DƯỚI sàn ngưỡng — tô cảnh báo relay sưởi (ENV-FR-004) */
  tooCold?: boolean
}

/**
 * "Trạng thái phân hệ điều khiển" — 4 relay thật (RelayStates, xem
 * firmware/README §pid) hiển thị dạng gauge nhị phân BẬT/TẮT, không bịa số %
 * "hiệu năng" vì backend không có khái niệm này — chỉ có is-on + control_mode
 * (AUTO/MANUAL). Card này KHÔNG cần nhãn dữ liệu giả vì mọi con số hiển thị
 * đều bám relay_states/control_mode thật qua socket telemetry.
 */
export default function ControlSubsystemPanel({
  zoneName, relayStates, controlMode, tooHot, tooCold,
}: ControlSubsystemPanelProps) {
  return (
    <Card size="lg" className="flex h-full flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-h2 text-charcoal">Trạng thái phân hệ điều khiển</h2>
          <p className="mt-1 text-sm text-warmGray">
            Relay thời gian thực{zoneName ? ` tại ${zoneName}` : ''}
          </p>
        </div>
        <Button variant="secondary" size="sm" disabled title="Chưa có trang chi tiết SCADA">
          Chi tiết SCADA ↗
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {RELAY_ITEMS.map(item => {
          const isOn = relayStates?.[item.key]
          // heating chống LẠNH (bật khi tooCold) — ventilation thoát nhiệt/chống NÓNG (bật khi tooHot).
          // Đảo ngược 2 cờ này từng khiến relay sưởi báo "Quá nhiệt" đúng lúc nhà yến đang quá lạnh.
          const anomalyLabel = item.key === 'heating' && tooCold ? 'Quá lạnh' : item.key === 'ventilation' && tooHot ? 'Quá nhiệt' : null
          const Icon = item.icon
          return (
            <div key={item.key} className="flex flex-col items-center gap-2 rounded-2xl border border-warmGray/15 p-3 text-center">
              <RadialGauge
                percent={relayStates === undefined ? 0 : isOn ? 100 : 0}
                size={76}
                strokeWidth={7}
                trackClassName="stroke-warmGray/10"
                className={cn(
                  relayStates === undefined ? 'stroke-warmGray/20' : anomalyLabel ? 'stroke-climateOrange' : isOn ? 'stroke-success' : 'stroke-warmGray/25',
                )}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <Icon width={16} height={16} className={cn(relayStates === undefined ? 'text-warmGray' : anomalyLabel ? 'text-climateOrange' : isOn ? 'text-success' : 'text-warmGray')} />
                  <span className="text-[11px] font-extrabold text-charcoal">
                    {relayStates === undefined ? '--' : isOn ? 'BẬT' : 'TẮT'}
                  </span>
                </div>
              </RadialGauge>
              <p className="label-caption leading-tight">{item.label}</p>
              <p className={cn('text-xs font-semibold', anomalyLabel ? 'text-climateOrange' : 'text-warmGray')}>
                {anomalyLabel ?? (controlMode ? `Chế độ ${controlMode}` : '--')}
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
