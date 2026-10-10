import { Wifi, WifiOff, AlertTriangle, Activity } from "lucide-react"
import type { ISensorNode } from "@/types"

export default function SystemHealthBar({ nodes = [] }: { nodes?: ISensorNode[] }) {
  const onlineCount = nodes.filter(n => n.status === "ONLINE").length;
  const offlineCount = nodes.filter(n => n.status === "OFFLINE").length;
  const pendingCount = nodes.filter(n => n.status === "PENDING").length;
  
  // Tính warning: Thiết bị đang manual hoặc OTA lỗi
  const warningCount = nodes.filter(n => n.control_mode === "MANUAL" || n.ota_failed).length;

  return (
    <div className="flex flex-col lg:flex-row gap-4 mb-6">
      <div className="flex-1 bg-white p-4 rounded-2xl border border-warmGray/10 shadow-sm flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs uppercase text-warmGray font-bold tracking-wider mb-1">Tổng số Node</span>
          <span className="text-3xl font-bold text-charcoal tabular-nums">{nodes.length}</span>
        </div>
        <div className="w-12 h-12 rounded-full bg-stone flex items-center justify-center text-charcoal">
          <Activity size={24} />
        </div>
      </div>
      
      <div className="flex-1 bg-white p-4 rounded-2xl border border-warmGray/10 shadow-sm flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs uppercase text-success font-bold tracking-wider mb-1">Online</span>
          <span className="text-3xl font-bold text-success tabular-nums">{onlineCount}</span>
        </div>
        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center text-success">
          <Wifi size={24} />
        </div>
      </div>

      <div className="flex-1 bg-white p-4 rounded-2xl border border-warmGray/10 shadow-sm flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs uppercase text-alertRed font-bold tracking-wider mb-1">Offline</span>
          <span className="text-3xl font-bold text-alertRed tabular-nums">{offlineCount}</span>
        </div>
        <div className="w-12 h-12 rounded-full bg-alertRed/10 flex items-center justify-center text-alertRed">
          <WifiOff size={24} />
        </div>
      </div>

      {(warningCount > 0 || pendingCount > 0) && (
        <div className="flex-1 bg-white p-4 rounded-2xl border border-warmGray/10 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs uppercase text-climateOrange font-bold tracking-wider mb-1">Cảnh báo / Chờ</span>
            <span className="text-3xl font-bold text-climateOrange tabular-nums">{warningCount + pendingCount}</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-climateOrange/10 flex items-center justify-center text-climateOrange">
            <AlertTriangle size={24} />
          </div>
        </div>
      )}
    </div>
  )
}
