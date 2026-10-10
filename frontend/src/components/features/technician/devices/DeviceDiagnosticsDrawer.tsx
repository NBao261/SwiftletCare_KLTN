import { useState } from "react"
import { Drawer } from "@/components/ui/Drawer"
import { Button, Badge } from "@/components/ui"
import RelayToggle from "@/components/features/technician/devices/RelayToggle"
import { useTelemetry } from "@/hooks/farm-owner/useTelemetry"
import type { ISensorNode } from "@/types"
import { useClearRelayOverride } from "@/hooks/shared/useDevices"
import { useToastStore } from "@/stores/toastStore"
import { getApiErrorMessage } from "@/lib/helpers"
import { Music, Play, Pause, Repeat, Clock, ListMusic, Copy } from "lucide-react"

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

const RELAY_LABELS = {
  misting: "Phun sương",
  speaker: "Loa ru",
  ventilation: "Quạt thông gió",
  heating: "Sưởi",
} as const;

interface DeviceDiagnosticsDrawerProps {
  node: ISensorNode | null
  zoneId: string
  onClose: () => void
  onOpenSchedule: () => void
  onOpenAudio: () => void
  onOpenReassign: () => void
  onOpenReplace: () => void
  onOpenDecommission: () => void
  canOnboard: boolean
}

export default function DeviceDiagnosticsDrawer({
  node,
  zoneId,
  onClose,
  onOpenSchedule,
  onOpenAudio,
  onOpenReassign,
  onOpenReplace,
  onOpenDecommission,
  canOnboard,
}: DeviceDiagnosticsDrawerProps) {
  const [activeTab, setActiveTab] = useState<"telemetry" | "audio" | "config">("telemetry")
  const telemetry = useTelemetry(node ? zoneId : undefined)
  const clearOverride = useClearRelayOverride()
  const push = useToastStore((s) => s.push)

  if (!node) return null

  // Helper để vẽ một hình tròn Gauge giả lập
  const renderGauge = (label: string, value: string | number | undefined, unit: string, colorClass: string) => (
    <div className="flex flex-col items-center justify-center p-4 bg-stone rounded-2xl">
      <div className={`text-2xl font-bold ${colorClass}`}>{value ?? "--"}</div>
      <div className="text-caption text-warmGray uppercase mt-1">{label}</div>
      <div className="text-xs text-charcoal">{unit}</div>
    </div>
  )

  return (
    <Drawer open={!!node} onClose={onClose} title="Diagnostics Cockpit">
      <div className="flex flex-col h-full overflow-y-auto pb-6">
        {/* Header Drawer */}
        <div className="flex flex-col gap-4 bg-charcoal/5 p-4 rounded-2xl mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-h3 font-bold text-charcoal">{node.device_id}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge tone={node.status === "ONLINE" ? "positive" : "neutral"}>
                  {node.status}
                </Badge>
                {node.ota_pending && <Badge tone="neutral" className="bg-blue-100 text-blue-700">Đang nạp OTA</Badge>}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-warmGray/10">
            <div>
              <p className="text-[10px] text-warmGray uppercase font-bold mb-1">MAC Address</p>
              <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-lg border border-warmGray/10 group cursor-pointer hover:border-primary/50 transition-colors">
                <p className="text-xs font-mono text-charcoal">{node.mac_address || "N/A"}</p>
                <Copy size={12} className="text-warmGray group-hover:text-primary transition-colors ml-auto" />
              </div>
            </div>
            <div>
              <p className="text-[10px] text-warmGray uppercase font-bold mb-1">IP Address</p>
              <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-lg border border-warmGray/10 group cursor-pointer hover:border-primary/50 transition-colors">
                <p className="text-xs font-mono text-charcoal">{node.ip_address || "N/A"}</p>
                <Copy size={12} className="text-warmGray group-hover:text-primary transition-colors ml-auto" />
              </div>
            </div>
            {node.config_pushed_at && (
              <div className="col-span-2 mt-1 flex justify-between text-xs text-warmGray">
                <span>Cấu hình nạp lần cuối:</span>
                <span className="font-medium text-charcoal">{new Date(node.config_pushed_at).toLocaleString("vi-VN")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 p-1 bg-stone rounded-xl mb-6">
          <button
            onClick={() => setActiveTab("telemetry")}
            className={`flex-1 py-2 text-small font-medium rounded-lg transition-colors ${activeTab === "telemetry" ? "bg-white text-charcoal shadow-sm" : "text-warmGray hover:text-charcoal"}`}
          >
            Môi trường
          </button>
          <button
            onClick={() => setActiveTab("audio")}
            className={`flex-1 py-2 text-small font-medium rounded-lg transition-colors ${activeTab === "audio" ? "bg-white text-charcoal shadow-sm" : "text-warmGray hover:text-charcoal"}`}
          >
            Âm thanh
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`flex-1 py-2 text-small font-medium rounded-lg transition-colors ${activeTab === "config" ? "bg-white text-charcoal shadow-sm" : "text-warmGray hover:text-charcoal"}`}
          >
            Cấu hình
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "telemetry" && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="grid grid-cols-3 gap-3">
              {renderGauge("Nhiệt độ", telemetry.data.temperature, "°C", "text-climateOrange")}
              {renderGauge("Độ ẩm", telemetry.data.humidity, "%", "text-success")}
              {renderGauge("Khí độc", telemetry.data.nh3_ppm, "PPM", "text-alertRed")}
            </div>
            
            <div className="h-24 bg-stone rounded-2xl flex items-center justify-center border border-warmGray/10 border-dashed">
              <span className="text-small text-warmGray">Biểu đồ Sparkline (24h)</span>
            </div>

            <div>
              <h3 className="text-small font-bold text-charcoal mb-3 uppercase tracking-wider">Manual Overrides</h3>
              {node.status === "PENDING" ? (
                <p className="rounded-xl bg-orange-300/25 px-3 py-2.5 text-xs font-medium text-charcoal">
                  Thiết bị chưa kết nối. Điều khiển sẽ bật khi online.
                </p>
              ) : (
                <div className="border border-warmGray/10 rounded-2xl p-4 divide-y divide-warmGray/10">
                  {node.control_mode === "MANUAL" && (
                    <div className="flex items-center justify-between gap-3 pb-3 mb-1">
                      <span className="text-xs font-medium text-climateOrange">
                        Đang ghi đè thủ công
                        {node.override_expiry ? ` — hết hạn ${timeLabel(node.override_expiry)}` : ""}
                      </span>
                      <Button
                        variant="secondary" size="sm"
                        loading={clearOverride.isPending && clearOverride.variables === node._id}
                        onClick={() =>
                          clearOverride.mutate(node._id, {
                            onSuccess: () => push("Đã trả về tự động"),
                            onError: (err) => push(getApiErrorMessage(err, "Lỗi"), "error"),
                          })
                        }
                      >
                        Về tự động
                      </Button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 pt-3">
                    {(Object.keys(RELAY_LABELS) as Array<keyof typeof RELAY_LABELS>).map((relayName) => (
                      <RelayToggle
                        key={relayName}
                        nodeId={node._id}
                        relayName={relayName}
                        label={RELAY_LABELS[relayName]}
                        checked={node.relay_states[relayName]}
                        mode={node.control_mode}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "audio" && (
          <div className="flex flex-col gap-4 animate-fade-in">
            {node.audio ? (
              <div className="bg-charcoal text-white rounded-2xl p-5 shadow-dock relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl rounded-full"></div>
                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <Music size={24} className="text-secondary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">Track {node.audio.current_track.toString().padStart(3, '0')}.mp3</p>
                      <p className="text-xs text-white/60">Đang phát tại thiết bị</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <button className="p-2 rounded-full hover:bg-white/10 text-white transition-colors">
                      {node.audio.playing ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" size={20} />}
                    </button>
                    <div className="flex-1">
                      <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-[75%] rounded-full relative">
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-sm"></div>
                        </div>
                      </div>
                    </div>
                    <button className={`p-2 rounded-full transition-colors ${node.audio.loop ? 'text-primary hover:bg-primary/10' : 'text-white/60 hover:bg-white/10'}`}>
                      <Repeat size={18} />
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs text-white/60 pt-2 border-t border-white/10 mt-1">
                    <span>Âm lượng: {node.audio.volume}%</span>
                    <span>Lịch: {node.speaker_schedule?.enabled ? `${node.speaker_schedule.windows[0]?.start} - ${node.speaker_schedule.windows[0]?.end}` : "Tắt"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 bg-stone rounded-2xl border border-warmGray/10 border-dashed">
                <Music size={24} className="mx-auto text-warmGray mb-2" />
                <p className="text-small text-charcoal font-medium">Không có thông tin Audio</p>
              </div>
            )}

            <Button variant="secondary" className="w-full justify-start h-14" onClick={onOpenSchedule}>
              <div className="w-8 h-8 rounded-full bg-stone shrink-0 flex items-center justify-center mr-2">
                <Clock size={16} className="text-charcoal" />
              </div>
              <div className="text-left">
                <p className="font-bold text-charcoal">Lịch phát loa ru</p>
                <p className="text-xs text-warmGray">Cài đặt giờ bật/tắt tự động</p>
              </div>
            </Button>
            <Button variant="secondary" className="w-full justify-start h-14" onClick={onOpenAudio}>
              <div className="w-8 h-8 rounded-full bg-stone shrink-0 flex items-center justify-center mr-2">
                <ListMusic size={16} className="text-charcoal" />
              </div>
              <div className="text-left">
                <p className="font-bold text-charcoal">Quản lý File Audio</p>
                <p className="text-xs text-warmGray">Danh sách file mp3 trên thẻ SD</p>
              </div>
            </Button>
          </div>
        )}

        {activeTab === "config" && (
          <div className="flex flex-col gap-4 animate-fade-in">
            {canOnboard && node.status === "ONLINE" && (
              <Button variant="secondary" onClick={onOpenReassign}>Dời sang Zone khác</Button>
            )}
            {canOnboard && (
              <div className="mt-4 p-4 border border-alertRed/30 rounded-2xl bg-alertRed/5 flex flex-col gap-3">
                <h4 className="text-small font-bold text-alertRed uppercase">Khu vực nguy hiểm</h4>
                <Button variant="secondary" onClick={onOpenReplace}>Thay thế thiết bị</Button>
                <Button variant="danger" onClick={onOpenDecommission}>Gỡ vĩnh viễn thiết bị</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  )
}
