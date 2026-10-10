import { IconDevice } from "@/components/ui/icons"
import { Wifi, WifiOff, Clock, Terminal, RotateCw, ChevronDown, ChevronUp, DownloadCloud, AlertTriangle } from "lucide-react"
import type { ISensorNode } from "@/types"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import { Badge } from "@/components/ui"
import StatusDot from "@/components/common/StatusDot"
import DeviceDiagnosticsPanel from "@/components/features/technician/devices/DeviceDiagnosticsPanel"

interface DeviceListRowProps {
  node: ISensorNode;
  zoneId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onReboot?: () => void;
  onPing?: () => void;
  onOpenSchedule: () => void;
  onOpenAudio: () => void;
  onOpenReassign: () => void;
  onOpenReplace: () => void;
  onOpenDecommission: () => void;
  canOnboard: boolean;
}

export default function DeviceListRow({ 
  node, zoneId, isExpanded, onToggleExpand, 
  onReboot, onPing,
  onOpenSchedule, onOpenAudio, onOpenReassign, onOpenReplace, onOpenDecommission, canOnboard 
}: DeviceListRowProps) {
  const isOnline = node.status === "ONLINE";
  
  const getRssiIcon = (rssi?: number) => {
    if (rssi === undefined) return <WifiOff size={14} className="text-warmGray" />;
    if (rssi > -60) return <Wifi size={14} className="text-success" />;
    if (rssi > -80) return <Wifi size={14} className="text-climateOrange" />;
    return <Wifi size={14} className="text-alertRed" />;
  }

  return (
    <div className={`flex flex-col transition-all duration-300 border-b last:border-b-0 border-warmGray/15 overflow-hidden ${isExpanded ? 'bg-stone/30' : 'bg-transparent hover:bg-stone/20'} ${!isOnline && node.status !== "PENDING" ? 'opacity-80 hover:opacity-100' : ''}`}>
      
      {/* Cột 1: Thông tin thiết bị */}
      <div 
        className="group flex flex-col md:flex-row md:items-center gap-4 p-3 cursor-pointer" 
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3 w-full md:w-3/12">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${isOnline ? 'bg-success/10 text-success' : 'bg-stone text-warmGray'}`}>
          <IconDevice />
        </div>
        <div className="min-w-0 flex flex-col">
          <p className="truncate font-bold text-charcoal">{node.device_id}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-warmGray font-mono uppercase bg-stone px-1.5 py-0.5 rounded">{node.mac_address || "NO MAC"}</span>
          </div>
        </div>
      </div>

      {/* Cột 2: Thông số kỹ thuật (FW, Mạng, Clock) */}
      <div className="flex flex-col gap-1.5 w-full md:w-3/12">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-warmGray">Firmware:</span>
          <span className="font-semibold text-charcoal">{node.firmware_version}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-charcoal font-medium">
            {getRssiIcon(node.rssi)}
            <span>{node.rssi ? `${node.rssi} dBm` : "Mất tín hiệu"}</span>
          </div>
          <span className="text-warmGray/30 hidden lg:inline">|</span>
          <div className="flex items-center gap-1.5 text-warmGray truncate">
            <Clock size={12} className="opacity-70 shrink-0" />
            <span className="truncate max-w-[120px]">{node.last_heartbeat ? formatDistanceToNow(new Date(node.last_heartbeat), { addSuffix: true, locale: vi }) : "Chưa kết nối"}</span>
          </div>
        </div>
      </div>

      {/* Cột 3: Trạng thái (Pills) */}
      <div className="flex flex-wrap items-center gap-2 w-full md:w-4/12">
        <div className="mr-2">
          {node.status === "ONLINE" && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-success/10 border border-success/20 text-success">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Trực tuyến</span>
            </div>
          )}
          {node.status === "OFFLINE" && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-warmGray/10 border border-warmGray/20 text-warmGray">
              <div className="w-1.5 h-1.5 rounded-full bg-warmGray" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Ngoại tuyến</span>
            </div>
          )}
          {node.status === "PENDING" && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-climateOrange/10 border border-climateOrange/20 text-climateOrange">
              <div className="w-1.5 h-1.5 rounded-full bg-climateOrange animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Chờ kết nối</span>
            </div>
          )}
          {!["ONLINE", "OFFLINE", "PENDING"].includes(node.status) && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-stone border border-warmGray/20 text-charcoal">
              <span className="text-[10px] font-bold uppercase tracking-wide">{node.status}</span>
            </div>
          )}
        </div>
        
        {node.control_mode === "MANUAL" && (
          <Badge tone="warning" className="text-[10px] px-2 py-0.5 shadow-sm">Thủ công</Badge>
        )}
        
        {node.ota_pending && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full shadow-sm">
            <DownloadCloud size={10} className="animate-bounce" /> Đang cập nhật
          </span>
        )}
        {node.ota_failed && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-alertRed bg-alertRed/10 border border-alertRed/20 px-2 py-0.5 rounded-full shadow-sm">
            <AlertTriangle size={10} /> Lỗi cập nhật
          </span>
        )}
      </div>

      {/* Cột 4: Quick Actions */}
      <div className="flex items-center gap-3 w-full md:w-2/12 md:justify-end border-t md:border-t-0 border-warmGray/10 pt-3 md:pt-0">
        <button 
          onClick={(e) => { e.stopPropagation(); onPing && onPing(); }}
          className="p-2 rounded-lg bg-stone text-charcoal hover:bg-white hover:shadow-sm hover:text-primary transition-all relative z-10 border border-transparent hover:border-primary/20"
          title="Ping kiểm tra kết nối"
        >
          <Terminal size={16} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onReboot && onReboot(); }}
          className="p-2 rounded-lg bg-stone text-charcoal hover:bg-white hover:shadow-sm hover:text-alertRed transition-all relative z-10 border border-transparent hover:border-alertRed/20"
          title="Khởi động lại (Reboot) từ xa"
        >
          <RotateCw size={16} />
        </button>
        <div className="w-[1px] h-6 bg-warmGray/20 hidden md:block mx-1"></div>
        <button 
          className={`p-2 rounded-lg transition-all flex items-center justify-center relative z-10 border border-transparent ${
            isExpanded 
              ? 'bg-primary text-white shadow-md' 
              : 'bg-stone text-charcoal hover:bg-warmGray/20'
          }`}
          title="Xem chi tiết thiết bị"
        >
          <ChevronDown size={16} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      </div>

      {/* Expanded Panel */}
      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="border-t border-warmGray/15 bg-white p-4 lg:p-5">
            <DeviceDiagnosticsPanel 
              node={node}
              zoneId={zoneId}
              onOpenSchedule={onOpenSchedule}
              onOpenAudio={onOpenAudio}
              onOpenReassign={onOpenReassign}
              onOpenReplace={onOpenReplace}
              onOpenDecommission={onOpenDecommission}
              canOnboard={canOnboard}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
