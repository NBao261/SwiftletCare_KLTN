import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui"
import RelayToggle from "@/components/features/technician/devices/RelayToggle"
import { useTelemetry } from "@/hooks/farm-owner/useTelemetry"
import type { ISensorNode } from "@/types"
import { useClearRelayOverride } from "@/hooks/shared/useDevices"
import { useToastStore } from "@/stores/toastStore"
import { getApiErrorMessage } from "@/lib/helpers"
import { Music, Play, Pause, Repeat, Clock, ListMusic, Thermometer, Droplets, Wind } from "lucide-react"

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

const RELAY_LABELS = {
  misting: "Phun sương",
  speaker: "Loa ru",
  ventilation: "Quạt thông gió",
  heating: "Sưởi",
} as const;

interface DeviceDiagnosticsPanelProps {
  node: ISensorNode
  zoneId: string
  onOpenSchedule: () => void
  onOpenAudio: () => void
  onOpenReassign: () => void
  onOpenReplace: () => void
  onOpenDecommission: () => void
  canOnboard: boolean
}

export default function DeviceDiagnosticsPanel({
  node,
  zoneId,
  onOpenSchedule,
  onOpenAudio,
  onOpenReassign,
  onOpenReplace,
  onOpenDecommission,
  canOnboard,
}: DeviceDiagnosticsPanelProps) {
  const [activeTab, setActiveTab] = useState<"telemetry" | "audio" | "config">("telemetry")
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const activeIndex = activeTab === "telemetry" ? 0 : activeTab === "audio" ? 1 : 2;
    const activeElement = tabRefs.current[activeIndex];
    if (activeElement) {
      setIndicatorStyle({
        left: activeElement.offsetLeft,
        width: activeElement.offsetWidth,
      });
    }
  }, [activeTab]);
  const telemetry = useTelemetry(zoneId)
  const clearOverride = useClearRelayOverride()
  const push = useToastStore((s) => s.push)

  const renderGauge = (IconComponent: any, label: string, value: string | number | undefined, unit: string, colorClass: string) => (
    <div className="flex flex-col items-center justify-center py-5 px-3 bg-white border border-warmGray/10 rounded-2xl shadow-sm relative overflow-hidden group hover:border-primary/20 transition-colors">
      <div className={`absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity ${colorClass}`}>
         <IconComponent size={90} />
      </div>
      <div className={`mb-1 ${colorClass}`}><IconComponent size={24} /></div>
      <div className={`text-3xl font-bold ${colorClass} mt-1 tabular-nums`}>{value ?? "--"}</div>
      <div className="text-sm font-bold text-charcoal uppercase mt-2 tracking-wide">{label}</div>
      <div className="text-xs font-semibold text-warmGray bg-stone px-2 py-0.5 rounded mt-1">{unit}</div>
    </div>
  )

  return (
    <div className="flex flex-col">
      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-white border border-warmGray/10 rounded-xl mb-6 self-start relative">
        <div 
          className="absolute top-1 bottom-1 bg-charcoal rounded-lg shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
        />
        <button
          ref={el => { tabRefs.current[0] = el; }}
          onClick={() => setActiveTab("telemetry")}
          className={`relative z-10 px-5 py-2 text-sm font-bold rounded-lg transition-colors duration-300 ${activeTab === "telemetry" ? "text-white" : "text-warmGray hover:text-charcoal"}`}
        >
          Môi trường & Rơ-le
        </button>
        <button
          ref={el => { tabRefs.current[1] = el; }}
          onClick={() => setActiveTab("audio")}
          className={`relative z-10 px-5 py-2 text-sm font-bold rounded-lg transition-colors duration-300 ${activeTab === "audio" ? "text-white" : "text-warmGray hover:text-charcoal"}`}
        >
          Âm thanh Loa ru
        </button>
        <button
          ref={el => { tabRefs.current[2] = el; }}
          onClick={() => setActiveTab("config")}
          className={`relative z-10 px-5 py-2 text-sm font-bold rounded-lg transition-colors duration-300 ${activeTab === "config" ? "text-white" : "text-warmGray hover:text-charcoal"}`}
        >
          Cấu hình Kỹ thuật
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "telemetry" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <div className="grid grid-cols-3 gap-4">
            {renderGauge(Thermometer, "Nhiệt độ", telemetry.data.temperature, "°C", "text-climateOrange")}
            {renderGauge(Droplets, "Độ ẩm", telemetry.data.humidity, "%", "text-success")}
            {renderGauge(Wind, "Khí độc", telemetry.data.nh3_ppm, "PPM", "text-alertRed")}
          </div>

          <div>
            <h3 className="text-small font-bold text-charcoal mb-3 uppercase tracking-wider">Manual Overrides</h3>
            {node.status === "PENDING" ? (
              <p className="rounded-xl bg-orange-300/25 px-3 py-2.5 text-xs font-medium text-charcoal">
                Thiết bị chưa kết nối. Điều khiển sẽ bật khi online.
              </p>
            ) : (
              <div className="bg-white border border-warmGray/10 rounded-2xl p-4 shadow-sm divide-y divide-warmGray/10">
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3">
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
        <div className="flex flex-col lg:flex-row gap-6 animate-fade-in">
          <div className="flex-1">
            {node.audio ? (
              <div className="bg-charcoal text-white rounded-2xl p-5 shadow-dock relative overflow-hidden h-full flex flex-col justify-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl rounded-full"></div>
                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <Music size={24} className="text-secondary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate text-lg">Track {node.audio.current_track.toString().padStart(3, '0')}.mp3</p>
                      <p className="text-xs text-white/60">Đang phát tại thiết bị</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2">
                    <button className="p-2 rounded-full hover:bg-white/10 text-white transition-colors">
                      {node.audio.playing ? <Pause fill="currentColor" size={24} /> : <Play fill="currentColor" size={24} />}
                    </button>
                    <div className="flex-1">
                      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-[75%] rounded-full relative">
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-sm"></div>
                        </div>
                      </div>
                    </div>
                    <button className={`p-2 rounded-full transition-colors ${node.audio.loop ? 'text-primary hover:bg-primary/10' : 'text-white/60 hover:bg-white/10'}`}>
                      <Repeat size={20} />
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs text-white/60 pt-3 border-t border-white/10 mt-2">
                    <span>Âm lượng: {node.audio.volume}%</span>
                    <span>Lịch: {node.speaker_schedule?.enabled ? `${node.speaker_schedule.windows[0]?.start} - ${node.speaker_schedule.windows[0]?.end}` : "Tắt"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 bg-white rounded-2xl border border-warmGray/10 border-dashed h-full flex flex-col items-center justify-center min-h-[160px]">
                <Music size={32} className="mx-auto text-warmGray mb-3" />
                <p className="text-small text-charcoal font-medium">Không có thông tin Audio</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 flex-1">
            <Button variant="secondary" className="w-full justify-start h-[76px] bg-white border border-warmGray/10 shadow-sm" onClick={onOpenSchedule}>
              <div className="w-10 h-10 rounded-full bg-stone shrink-0 flex items-center justify-center mr-3">
                <Clock size={20} className="text-charcoal" />
              </div>
              <div className="text-left">
                <p className="font-bold text-charcoal">Lịch phát loa ru</p>
                <p className="text-xs text-warmGray mt-0.5">Cài đặt giờ bật/tắt tự động</p>
              </div>
            </Button>
            <Button variant="secondary" className="w-full justify-start h-[76px] bg-white border border-warmGray/10 shadow-sm" onClick={onOpenAudio}>
              <div className="w-10 h-10 rounded-full bg-stone shrink-0 flex items-center justify-center mr-3">
                <ListMusic size={20} className="text-charcoal" />
              </div>
              <div className="text-left">
                <p className="font-bold text-charcoal">Quản lý File Audio</p>
                <p className="text-xs text-warmGray mt-0.5">Danh sách file mp3 trên thẻ SD</p>
              </div>
            </Button>
          </div>
        </div>
      )}

      {activeTab === "config" && (
        <div className="flex flex-col md:flex-row gap-4 animate-fade-in">
          {canOnboard && node.status === "ONLINE" && (
            <div className="flex-1 p-5 bg-white border border-warmGray/10 rounded-2xl shadow-sm">
              <h4 className="text-small font-bold text-charcoal mb-4 uppercase">Điều chuyển Zone</h4>
              <p className="text-xs text-warmGray mb-4">Dời thiết bị này sang Zone khác. Yêu cầu thiết bị đang online để nhận cấu hình mới.</p>
              <Button variant="secondary" onClick={onOpenReassign} className="w-full">Dời sang Zone khác</Button>
            </div>
          )}
          {canOnboard && (
            <div className="flex-1 p-5 border border-alertRed/30 rounded-2xl bg-alertRed/5 shadow-sm">
              <h4 className="text-small font-bold text-alertRed mb-4 uppercase">Khu vực nguy hiểm</h4>
              <p className="text-xs text-alertRed/80 mb-4">Thao tác không thể hoàn tác. Việc thay thế sẽ giữ lại ID nhưng trỏ phần cứng mới.</p>
              <div className="flex flex-col gap-3">
                <Button variant="secondary" onClick={onOpenReplace} className="w-full">Thay thế phần cứng</Button>
                <Button variant="danger" onClick={onOpenDecommission} className="w-full">Gỡ vĩnh viễn thiết bị</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
