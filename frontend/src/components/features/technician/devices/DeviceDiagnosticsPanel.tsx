import { useState, useRef, useEffect } from "react"
import { Badge, Button } from "@/components/ui"
import DeviceInfoCard from "@/components/features/technician/devices/DeviceInfoCard"
import { useSendNodeCommand } from "@/hooks/shared/useDevices"
import { useToastStore } from "@/stores/toastStore"
import { getApiErrorMessage } from "@/lib/helpers"
import type { SensorNode } from "@/types"
import { Music, Clock, ListMusic } from "lucide-react"

interface DeviceDiagnosticsPanelProps {
  node: SensorNode
  zoneId?: string
  onOpenAudio: () => void
  onOpenReassign: () => void
  onOpenReplace: () => void
  onOpenDecommission: () => void
  canOnboard: boolean
}

export default function DeviceDiagnosticsPanel({
  node,
  zoneId: _zoneId,
  onOpenAudio,
  onOpenReassign,
  onOpenReplace,
  onOpenDecommission,
  canOnboard,
}: DeviceDiagnosticsPanelProps) {
  const [activeTab, setActiveTab] = useState<"config" | "audio">("config")
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const sendCommand = useSendNodeCommand()
  const push = useToastStore(s => s.push)

  function handlePushConfig() {
    sendCommand.mutate(
      { nodeId: node._id, input: { command: "PUSH_CONFIG" } },
      {
        onSuccess: () => push(`Đã gửi lệnh đồng bộ cấu hình tới ${node.device_id}`),
        onError: (err) => push(getApiErrorMessage(err, "Đồng bộ cấu hình thất bại"), "error"),
      }
    )
  }

  useEffect(() => {
    const activeIndex = activeTab === "config" ? 0 : 1;
    const activeElement = tabRefs.current[activeIndex];
    if (activeElement) {
      setIndicatorStyle({
        left: activeElement.offsetLeft,
        width: activeElement.offsetWidth,
      });
    }
  }, [activeTab]);

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
          onClick={() => setActiveTab("config")}
          className={`relative z-10 px-5 py-2 text-sm font-bold rounded-lg transition-colors duration-300 ${activeTab === "config" ? "text-white" : "text-warmGray hover:text-charcoal"}`}
        >
          Cấu hình Kỹ thuật
        </button>
        <button
          ref={el => { tabRefs.current[1] = el; }}
          onClick={() => setActiveTab("audio")}
          className={`relative z-10 px-5 py-2 text-sm font-bold rounded-lg transition-colors duration-300 ${activeTab === "audio" ? "text-white" : "text-warmGray hover:text-charcoal"}`}
        >
          Âm thanh Loa ru
        </button>
      </div>

      {/* Tab Content */}

      {activeTab === "audio" && (
        <div className="flex flex-col lg:flex-row gap-6 animate-fade-in">
          <div className="flex-1">
            {node.audio ? (
              /* Chỉ hiển thị dữ liệu thật từ node: bài mặc định, âm lượng (0–30), lịch phát */
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-warmGray/15 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="label-caption">Cấu hình loa hiện tại</p>
                  <Badge tone={node.speaker_schedule?.enabled ? "positive" : "neutral"}>
                    {node.speaker_schedule?.enabled ? "Đang bật lịch" : "Lịch đang tắt"}
                  </Badge>
                </div>
                <dl className="grid grid-cols-3 gap-3">
                  <div>
                    <dt className="label-caption">Bài mặc định</dt>
                    <dd className="mt-1 font-bold text-charcoal tabular-nums">{String(node.audio.current_track).padStart(4, "0")}.mp3</dd>
                  </div>
                  <div>
                    <dt className="label-caption">Âm lượng</dt>
                    <dd className="mt-1 font-bold text-charcoal tabular-nums">{node.audio.volume}/30</dd>
                  </div>
                  <div>
                    <dt className="label-caption">Lặp lại</dt>
                    <dd className="mt-1 font-bold text-charcoal">{node.audio.loop ? "Bật" : "Tắt"}</dd>
                  </div>
                </dl>
                <div className="border-t border-warmGray/15 pt-3">
                  <p className="label-caption mb-2">Khung giờ phát</p>
                  {node.speaker_schedule?.windows?.length ? (
                    <ul className="flex flex-wrap gap-2">
                      {node.speaker_schedule.windows.map((w, i) => (
                        <li key={i} className="flex items-center gap-1.5 rounded-full bg-warmGray/10 px-3 py-1 text-xs font-semibold text-charcoal tabular-nums">
                          <Clock size={12} className="text-warmGray" /> {w.start} – {w.end}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-warmGray">Chưa cài khung giờ nào.</p>
                  )}
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
            {/* Lịch loa ru là của Farm Owner (§2.4, BR-07) — màn này chỉ còn quản lý bài loa (Technician, ENV-FR-013c).
                Thiết bị PENDING chưa nhận cấu hình nên chưa cho chỉnh file loa */}
            {node.status === "PENDING" ? (
              <p className="rounded-xl bg-orange-300/25 px-3 py-2.5 text-xs font-medium text-charcoal">
                Thiết bị chưa kết nối. File loa ru sẽ chỉnh được khi thiết bị online.
              </p>
            ) : canOnboard && (
              <Button variant="secondary" className="w-full justify-start h-[76px] bg-white border border-warmGray/10 shadow-sm" onClick={onOpenAudio}>
                <div className="w-10 h-10 rounded-full bg-stone shrink-0 flex items-center justify-center mr-3">
                  <ListMusic size={20} className="text-charcoal" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-charcoal">Quản lý File Audio</p>
                  <p className="text-xs text-warmGray mt-0.5">Danh sách file mp3 trên thẻ SD</p>
                </div>
              </Button>
            )}
          </div>
        </div>
      )}

      {activeTab === "config" && (
        <div className="flex flex-col gap-4 animate-fade-in">
        <DeviceInfoCard node={node} />
        <div className="flex flex-col md:flex-row gap-4">
          {canOnboard && node.status === "ONLINE" && (
            <div className="flex-1 p-5 bg-white border border-warmGray/10 rounded-2xl shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="text-small font-bold text-charcoal mb-1">Thao tác thiết bị</h4>
                <p className="text-xs text-warmGray mb-4">Đồng bộ lại cấu hình chuẩn từ Zone hoặc dời thiết bị sang Zone khác khi cần thiết.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="secondary"
                  onClick={handlePushConfig}
                  loading={sendCommand.isPending}
                  className="flex-1"
                >
                  Đồng bộ cấu hình
                </Button>
                <Button
                  variant="secondary"
                  onClick={onOpenReassign}
                  className="flex-1"
                >
                  Dời Zone
                </Button>
              </div>
            </div>
          )}
          {canOnboard && (
            <div className="flex-1 p-5 border border-alertRed/30 rounded-2xl bg-alertRed/5 shadow-sm">
              <h4 className="text-small font-bold text-alertRed mb-4">Khu vực nguy hiểm</h4>
              <p className="text-xs text-alertRed/80 mb-4">Thao tác không thể hoàn tác. Việc thay thế sẽ giữ lại ID nhưng trỏ phần cứng mới.</p>
              <div className="flex flex-col gap-3">
                <Button variant="secondary" onClick={onOpenReplace} className="w-full">Thay thế phần cứng</Button>
                <Button variant="danger" onClick={onOpenDecommission} className="w-full">Gỡ vĩnh viễn thiết bị</Button>
              </div>
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  )
}
