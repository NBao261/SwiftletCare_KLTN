import { Card, Badge } from "@/components/ui"
import { IconDevice } from "@/components/ui/icons"
import StatusDot from "@/components/common/StatusDot"
import type { ISensorNode } from "@/types"
import { Wifi, WifiOff, Clock, DownloadCloud, AlertTriangle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"

const getRssiIcon = (rssi?: number) => {
  if (rssi === undefined) return <WifiOff size={14} className="text-warmGray" />;
  if (rssi > -60) return <Wifi size={14} className="text-success" />;
  if (rssi > -80) return <Wifi size={14} className="text-climateOrange" />;
  return <Wifi size={14} className="text-alertRed" />;
}

interface DeviceCardProps {
  node: ISensorNode
  telemetryData?: { temperature?: number; humidity?: number }
  onClick: () => void
}

export default function DeviceCard({ node, telemetryData, onClick }: DeviceCardProps) {
  // Lấy nhiệt độ và độ ẩm mặc định hoặc từ API telemetry
  const temp = telemetryData?.temperature ?? 28.5
  const humid = telemetryData?.humidity ?? 85.2
  const isOnline = node.status === "ONLINE"
  const isPending = node.status === "PENDING"

  // Thay đổi nền Card theo trạng thái
  const bgStyle = isPending
    ? "bg-stone/50 opacity-80"
    : isOnline
    ? "bg-gradient-to-br from-white/90 to-limeMist/10 border-success/20"
    : "bg-gradient-to-br from-white/90 to-alertRed/5 border-alertRed/10"

  return (
    <div onClick={onClick} className="cursor-pointer h-full group">
      <Card className={`relative h-full border border-warmGray/10 backdrop-blur-md shadow-card transition-all duration-300 hover:shadow-dock hover:-translate-y-1 rounded-3xl p-5 flex flex-col justify-between ${bgStyle}`}>
        {/* TOP ROW: Icon + Tên + Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-icon transition-colors duration-300 ${isOnline ? 'bg-success/20 text-success' : 'bg-stone text-charcoal'}`}>
              <IconDevice />
            </div>
            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-2">
                <p className="truncate text-h3 font-bold text-charcoal">{node.device_id}</p>
                {node.control_mode === "MANUAL" && (
                  <div className="flex flex-col">
                    <Badge tone="warning" className="scale-75 origin-left shrink-0">Tay</Badge>
                    {node.override_expiry && <span className="text-[9px] text-climateOrange font-medium -mt-1 ml-1">{new Date(node.override_expiry).toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit"})}</span>}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 mt-1">
                <p className="truncate text-caption text-charcoal font-medium">FW: {node.firmware_version}</p>
                <div className="flex items-center gap-1.5 text-[11px] text-warmGray">
                  <div className="flex items-center gap-1">{getRssiIcon(node.rssi)} <span>{node.rssi ? `${node.rssi} dBm` : "No signal"}</span></div>
                  <span className="text-charcoal/20">•</span>
                  <div className="flex items-center gap-1"><Clock size={12} /> <span>{node.last_heartbeat ? formatDistanceToNow(new Date(node.last_heartbeat), { addSuffix: true, locale: vi }) : "Chưa kết nối"}</span></div>
                </div>
              </div>
            </div>
          </div>
          <div className="shrink-0 mt-1">
            <StatusDot status={node.status} />
          </div>
        </div>
        </div>
        
        {/* OTA Status */}
        {node.ota_pending && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-blue-500/10 text-blue-600 px-2.5 py-1 rounded-full text-[10px] font-bold">
            <DownloadCloud size={12} className="animate-bounce" /> Đang cập nhật FW...
          </div>
        )}
        {node.ota_failed && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-alertRed/10 text-alertRed px-2.5 py-1 rounded-full text-[10px] font-bold">
            <AlertTriangle size={12} /> Lỗi nạp OTA
          </div>
        )}

        {/* BOTTOM ROW: Số liệu Telemetry */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="flex flex-col bg-white/60 p-3.5 rounded-[20px] border border-white/40 shadow-sm relative overflow-hidden group-hover:bg-white transition-colors duration-300">
            <div className="flex items-center gap-1.5 mb-2 text-climateOrange">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/><path d="M11.5 6v6"/></svg>
              <span className="text-[10px] uppercase font-bold text-warmGray tracking-wider truncate">Nhiệt độ</span>
            </div>
            <div className="flex items-baseline gap-0.5">
              <p className="text-[26px] leading-none font-semibold text-charcoal tabular-nums tracking-tight">
                {temp}
              </p>
              <span className="text-sm font-medium text-warmGray">°C</span>
            </div>
          </div>
          
          <div className="flex flex-col bg-white/60 p-3.5 rounded-[20px] border border-white/40 shadow-sm relative overflow-hidden group-hover:bg-white transition-colors duration-300">
            <div className="flex items-center gap-1.5 mb-2 text-[#0ea5e9]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
              <span className="text-[10px] uppercase font-bold text-warmGray tracking-wider truncate">Độ ẩm</span>
            </div>
            <div className="flex items-baseline gap-0.5">
              <p className="text-[26px] leading-none font-semibold text-charcoal tabular-nums tracking-tight">
                {humid}
              </p>
              <span className="text-sm font-medium text-warmGray">%</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
