import { RotateCw, ChevronDown, DownloadCloud, AlertTriangle, Clock } from "lucide-react"
import { IconDevice } from "@/components/ui/icons"
import type { SensorNode } from "@/types"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import { Badge } from "@/components/ui"
import ActionsMenu, { type ActionsMenuItem } from "@/components/ui/ActionsMenu"
import StatusDot from "@/components/common/StatusDot"
import SimulatedBadge from "@/components/common/SimulatedBadge"
import DeviceDiagnosticsPanel from "@/components/features/technician/devices/DeviceDiagnosticsPanel"

// Cột của danh sách: thiết bị, vị trí, trạng thái, kết nối, thao tác; dòng tiêu đề dùng chung khuôn này
export const DEVICE_ROW_GRID = "md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1.1fr)_7.5rem]"

interface DeviceListRowProps {
  node: SensorNode;
  zoneId?: string;
  // Tên nhà và Zone của thiết bị: trang trại đã có ở thanh phạm vi
  houseName?: string;
  zoneName?: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  // Không truyền → ẩn nút (role không có quyền gửi lệnh RESTART)
  onReboot?: () => void;
  // Firmware chưa hỗ trợ lệnh RESTART (BE trả 501) → khoá nút + tooltip giải thích
  rebootUnsupported?: boolean;
  onOpenAudio: () => void;
  // Dời, thay, gỡ bộ điều khiển; không truyền thì ẩn menu
  moreActions?: ActionsMenuItem[];
}

const STALE_HEARTBEAT_MS = 5 * 60 * 1000

// 4 vạch tín hiệu từ RSSI thật (dBm): > -60 mạnh, > -70 khá, > -80 yếu, còn lại rất yếu
function RssiBars({ rssi }: { rssi?: number }) {
  const level = rssi === undefined || rssi === null ? 0 : rssi > -60 ? 4 : rssi > -70 ? 3 : rssi > -80 ? 2 : 1
  const tone = level >= 3 ? "bg-success" : level === 2 ? "bg-climateOrange" : "bg-alertRed"
  return (
    <span className="inline-flex items-end gap-[2px] h-3.5" role="img" aria-label={rssi !== undefined ? `Tín hiệu ${rssi} dBm` : "Không có tín hiệu"}>
      {[1, 2, 3, 4].map(i => (
        <span
          key={i}
          style={{ height: `${i * 25}%` }}
          className={`w-[3px] rounded-sm ${i <= level ? tone : "bg-warmGray/25"}`}
        />
      ))}
    </span>
  )
}

export default function DeviceListRow({
  node, zoneId, houseName, zoneName, isExpanded, onToggleExpand,
  onReboot, rebootUnsupported,
  onOpenAudio, moreActions,
}: DeviceListRowProps) {
  const isOnline = node.status === "ONLINE";

  const hb = node.last_heartbeat ? new Date(node.last_heartbeat) : null
  const stale = hb ? Date.now() - hb.getTime() > STALE_HEARTBEAT_MS : false

  return (
    <div className={`border-b last:border-b-0 border-warmGray/15 transition-colors duration-200 ${isExpanded ? 'bg-stone/30' : 'hover:bg-stone/20'}`}>
      <div
        onClick={onToggleExpand}
        className={`group grid cursor-pointer gap-x-4 gap-y-3 px-4 py-3.5 md:items-center ${DEVICE_ROW_GRID}`}
      >
        {/* Thiết bị: mã, phiên bản firmware */}
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isOnline ? 'bg-success/10 text-charcoal' : 'bg-stone text-warmGray'}`}>
            <IconDevice />
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-charcoal">{node.device_id}</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-warmGray">
              <SimulatedBadge simulated={node.simulated} />
              <span>v{node.firmware_version || "—"}</span>
            </div>
          </div>
        </div>

        {/* Vị trí: nhà ở trên, Zone ở dưới */}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-charcoal" title={houseName}>{houseName ?? "—"}</p>
          <p className="truncate text-xs text-warmGray" title={zoneName}>{zoneName ?? "—"}</p>
        </div>

        {/* Trạng thái và các nhãn phụ */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusDot status={node.status} colored />
          {node.activation_overdue_at && <Badge tone="warning">Quá hạn kích hoạt</Badge>}
          {node.control_mode === "MANUAL" && <Badge tone="warning">Điều khiển tay</Badge>}
          {node.ota_pending && (
            <span className="inline-flex items-center gap-1 rounded-full bg-limeMist px-2.5 py-1 text-xs font-semibold text-charcoal">
              <DownloadCloud size={12} /> Đang cập nhật
            </span>
          )}
          {node.ota_failed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-alertRed/10 px-2.5 py-1 text-xs font-semibold text-alertRed">
              <AlertTriangle size={12} /> Cập nhật lỗi
            </span>
          )}
        </div>

        {/* Kết nối: sóng Wi-Fi và lần gửi tín hiệu cuối */}
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center gap-2 font-medium tabular-nums text-charcoal">
            <RssiBars rssi={node.rssi} />
            <span>{node.rssi !== undefined && node.rssi !== null ? `${node.rssi} dBm` : "Mất tín hiệu"}</span>
          </div>
          <div className={`flex items-center gap-1.5 ${stale ? 'font-semibold text-climateOrange' : 'text-warmGray'}`}>
            <Clock size={12} className="shrink-0" />
            <span className="truncate tabular-nums">{hb ? formatDistanceToNow(hb, { addSuffix: true, locale: vi }) : "Chưa kết nối"}</span>
          </div>
        </div>

        {/* Thao tác: khởi động lại, dời/thay/gỡ, mở chi tiết */}
        <div className="flex items-center gap-1.5 border-t border-warmGray/10 pt-3 md:justify-end md:border-t-0 md:pt-0">
          {onReboot && (
            <button
              type="button"
              disabled={rebootUnsupported}
              onClick={(event) => { event.stopPropagation(); onReboot(); }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-charcoal transition-colors max-sm:h-11 max-sm:w-11 hover:bg-white hover:text-alertRed disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-charcoal"
              title={rebootUnsupported ? "Firmware chưa hỗ trợ lệnh này" : "Khởi động lại thiết bị từ xa"}
              aria-label="Khởi động lại thiết bị"
            >
              <RotateCw size={16} />
            </button>
          )}
          {moreActions && moreActions.length > 0 && <div onClick={(event) => event.stopPropagation()}><ActionsMenu items={moreActions} /></div>}
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onToggleExpand(); }}
            aria-expanded={isExpanded}
            aria-label="Xem chi tiết thiết bị"
            title="Xem chi tiết thiết bị"
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors max-sm:ml-auto max-sm:h-11 max-sm:w-11 ${isExpanded ? 'bg-charcoal text-white' : 'text-charcoal group-hover:bg-white'}`}
          >
            <ChevronDown size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Panel mở rộng: animate chiều cao 220ms */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-[220ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-warmGray/15 bg-white p-4 lg:p-5">
            {isExpanded && (
              <DeviceDiagnosticsPanel
                node={node}
                zoneId={zoneId || node.zone_id}
                onOpenAudio={onOpenAudio}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
