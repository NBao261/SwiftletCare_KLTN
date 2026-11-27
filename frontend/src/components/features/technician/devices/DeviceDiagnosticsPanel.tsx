import { Badge, Button } from "@/components/ui"
import DeviceInfoCard from "@/components/features/technician/devices/DeviceInfoCard"
import type { SensorNode } from "@/types"
import { devicesDict } from "@/constants/devices.i18n"
import { useTranslation } from "@/hooks/common/useTranslation"
import { Clock, ListMusic } from "lucide-react"

interface DeviceDiagnosticsPanelProps {
  node: SensorNode
  zoneId?: string
  onOpenAudio: () => void
}

// Chi tiết một thiết bị: thông tin chẩn đoán và loa ru cạnh nhau, không chia tab vì chỉ có hai khối
export default function DeviceDiagnosticsPanel({ node, onOpenAudio }: DeviceDiagnosticsPanelProps) {
  const { t } = useTranslation(devicesDict)
  const schedule = node.speaker_schedule
  return (
    <div className="grid animate-fade-in gap-4 motion-reduce:animate-none lg:grid-cols-2">
      <DeviceInfoCard node={node} />

      <div className="flex flex-col gap-4 rounded-2xl border border-warmGray/15 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-small font-bold text-charcoal">{t("tech.speaker.title")}</h4>
          {node.audio && (
            <Badge tone={schedule?.enabled ? "positive" : "neutral"}>{t(schedule?.enabled ? "tech.speaker.scheduleOn" : "tech.speaker.scheduleOff")}</Badge>
          )}
        </div>

        {node.audio ? (
          // Chỉ dữ liệu thật từ thiết bị: bài mặc định, âm lượng (0–30), lặp lại, khung giờ phát
          <>
            <dl className="grid grid-cols-3 gap-4">
              <div>
                <dt className="label-caption">{t("tech.speaker.track")}</dt>
                <dd className="mt-1 font-bold tabular-nums text-charcoal">{String(node.audio.current_track).padStart(4, "0")}.mp3</dd>
              </div>
              <div>
                <dt className="label-caption">{t("tech.speaker.volume")}</dt>
                <dd className="mt-1 font-bold tabular-nums text-charcoal">{node.audio.volume}/30</dd>
              </div>
              <div>
                <dt className="label-caption">{t("tech.speaker.loop")}</dt>
                <dd className="mt-1 font-bold text-charcoal">{t(node.audio.loop ? "tech.on" : "tech.off")}</dd>
              </div>
            </dl>
            <div>
              <p className="label-caption mb-2">{t("tech.speaker.windows")}</p>
              {schedule?.windows?.length ? (
                <ul className="flex flex-wrap gap-2">
                  {schedule.windows.map((window, index) => (
                    <li key={index} className="flex items-center gap-1.5 rounded-full bg-warmGray/10 px-3 py-1 text-xs font-semibold tabular-nums text-charcoal">
                      <Clock size={12} className="text-warmGray" /> {window.start} – {window.end}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-warmGray">{t("tech.speaker.noWindows")}</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-small text-warmGray">{t("tech.speaker.noConfig")}</p>
        )}

        {/* Farm Technician chỉ xem danh sách bài loa; thiết bị PENDING chưa có cấu hình loa */}
        <div className="mt-auto border-t border-warmGray/15 pt-4">
          {node.status === "PENDING" ? (
            <p className="text-xs font-medium text-warmGray">{t("tech.speaker.pending")}</p>
          ) : (
            <Button variant="secondary" size="sm" onClick={onOpenAudio}>
              <ListMusic size={16} />
              {t("tech.speaker.tracks")}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
