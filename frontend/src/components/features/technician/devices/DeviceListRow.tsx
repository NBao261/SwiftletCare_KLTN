import { RotateCw, ChevronDown, DownloadCloud, AlertTriangle, Clock } from "lucide-react"
import { IconDevice } from "@/components/ui/icons"
import type { SensorNode } from "@/types"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import { Badge } from "@/components/ui"
import DeviceDiagnosticsPanel from "@/components/features/technician/devices/DeviceDiagnosticsPanel"

interface DeviceListRowProps {
  node: SensorNode;
  zoneId: string;
  index?: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  /** Không truyền → ẩn nút (role không có quyền gửi lệnh, VD Farm Owner) */
  onReboot?: () => void;
  /** Firmware chưa hỗ trợ lệnh RESTART (BE trả 501) → khoá nút + tooltip giải thích */
  rebootUnsupported?: boolean;
  onOpenAudio: () => void;
  onOpenReassign: () => void;
  onOpenReplace: () => void;
  onOpenDecommission: () => void;
  canOnboard: boolean;
}

const STALE_HEARTBEAT_MS = 5 * 60 * 1000

/** 4 vạch tín hiệu từ RSSI thật (dBm): > -60 mạnh, > -70 khá, > -80 yếu, còn lại rất yếu */
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

const STATUS_BADGE: Record<string, { label: string; cls: string; dot: string; pulse?: boolean; blink?: boolean; accent: string }> = {
  ONLINE:   { label: "Online",       cls: "bg-success/15 text-charcoal",     dot: "bg-success", pulse: true, accent: "bg-success" },
  OFFLINE:  { label: "Mất kết nối",  cls: "bg-warmGray/15 text-graphite",    dot: "bg-warmGray", accent: "bg-warmGray/60" },
  PENDING:  { label: "Chờ kết nối",  cls: "bg-climateOrange/15 text-charcoal", dot: "bg-climateOrange", pulse: true, accent: "bg-climateOrange/70" },
  DEGRADED: { label: "Suy giảm",     cls: "bg-climateOrange/15 text-charcoal", dot: "bg-climateOrange", accent: "bg-climateOrange" },
  ERROR:    { label: "Lỗi",          cls: "bg-alertRed/10 text-alertRed",    dot: "bg-alertRed", blink: true, accent: "bg-alertRed" },
}

export default function DeviceListRow({
  node, zoneId, index = 0, isExpanded, onToggleExpand,
  onReboot, rebootUnsupported,
  onOpenAudio, onOpenReassign, onOpenReplace, onOpenDecommission, canOnboard
}: DeviceListRowProps) {
  const isOnline = node.status === "ONLINE";
  const badge = STATUS_BADGE[node.status] ?? { label: node.status, cls: "bg-stone text-charcoal", dot: "bg-warmGray", accent: "bg-transparent" };

  const hb = node.last_heartbeat ? new Date(node.last_heartbeat) : null
  const stale = hb ? Date.now() - hb.getTime() > STALE_HEARTBEAT_MS : false

  return (
    <div
      style={{ animationDelay: `${Math.min(index, 10) * 20}ms` }}
      className={`relative flex flex-col border-b last:border-b-0 border-warmGray/15 overflow-hidden animate-fade-in motion-reduce:animate-none transition-colors duration-200 ${isExpanded ? 'bg-stone/30' : 'bg-transparent hover:bg-stone/20'}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 z-10 w-[3px] ${badge.accent}`} />
      <div
        className="group flex flex-col md:flex-row md:items-center gap-4 p-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Cột 1: Mã thiết bị + firmware */}
        <div className="flex items-center gap-3 w-full md:w-3/12 min-w-0">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isOnline ? 'bg-success/10 text-charcoal' : 'bg-stone text-warmGray'}`}>
            <IconDevice />
          </div>
          <div className="min-w-0 flex flex-col">
            <p className="truncate font-mono font-bold text-charcoal">{node.device_id}</p>
            <p className="mt-0.5 truncate font-mono text-xs text-warmGray">
              Firmware {node.firmware_version || "—"}
            </p>
          </div>
        </div>

        {/* Cột 2: Tín hiệu + heartbeat */}
        <div className="flex flex-col gap-1.5 w-full md:w-3/12 text-xs">
          <div className="flex items-center gap-2 text-charcoal font-medium tabular-nums">
            <RssiBars rssi={node.rssi} />
            <span>{node.rssi !== undefined && node.rssi !== null ? `${node.rssi} dBm` : "Mất tín hiệu"}</span>
          </div>
          <div className={`flex items-center gap-1.5 truncate ${stale ? 'text-climateOrange font-semibold' : 'text-warmGray'}`}>
            <Clock size={12} className="shrink-0" />
            <span className="truncate tabular-nums">
              {hb ? formatDistanceToNow(hb, { addSuffix: true, locale: vi }) : "Chưa kết nối"}
            </span>
          </div>
        </div>

        {/* Cột 3: Trạng thái + chip phụ */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-4/12">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}>
            <span className="relative flex h-1.5 w-1.5">
              {badge.pulse && <span className={`absolute inline-flex h-full w-full rounded-full ${badge.dot} animate-ping-soft motion-reduce:animate-none`} />}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${badge.dot} ${badge.blink ? 'animate-pulse-dot motion-reduce:animate-none' : ''}`} />
            </span>
            {badge.label}
          </span>

          {node.activation_overdue_at && (
            <Badge tone="warning">Quá hạn kích hoạt</Badge>
          )}
          {node.control_mode === "MANUAL" && <Badge tone="warning">Điều khiển thủ công</Badge>}
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

        {/* Cột 4: Thao tác */}
        <div className="flex items-center gap-2 w-full md:w-2/12 md:justify-end border-t md:border-t-0 border-warmGray/10 pt-3 md:pt-0">
          {onReboot && (
            <>
              <button
                type="button"
                disabled={rebootUnsupported}
                onClick={(e) => { e.stopPropagation(); onReboot(); }}
                className="relative z-10 rounded-lg border border-transparent bg-stone p-2 text-charcoal opacity-70 transition-all group-hover:opacity-100 hover:bg-white hover:text-alertRed hover:border-alertRed/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-stone disabled:hover:text-charcoal disabled:hover:border-transparent"
                title={rebootUnsupported ? "Firmware chưa hỗ trợ lệnh này" : "Khởi động lại thiết bị từ xa"}
                aria-label="Khởi động lại thiết bị"
              >
                <RotateCw size={16} />
              </button>
              <span className="mx-1 hidden h-6 w-px bg-warmGray/20 md:block" />
            </>
          )}
          <button
            type="button"
            className={`relative z-10 flex items-center justify-center rounded-lg border border-transparent p-2 transition-colors ${isExpanded ? 'bg-charcoal text-white' : 'bg-stone text-charcoal hover:bg-warmGray/20'}`}
            title="Xem chi tiết thiết bị"
            aria-expanded={isExpanded}
            aria-label="Xem chi tiết thiết bị"
          >
            <ChevronDown size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Panel mở rộng — animate chiều cao 220ms */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-[220ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-warmGray/15 bg-white p-4 lg:p-5">
            {isExpanded && (
              <DeviceDiagnosticsPanel
                node={node}
                zoneId={zoneId}
                onOpenAudio={onOpenAudio}
                onOpenReassign={onOpenReassign}
                onOpenReplace={onOpenReplace}
                onOpenDecommission={onOpenDecommission}
                canOnboard={canOnboard}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
