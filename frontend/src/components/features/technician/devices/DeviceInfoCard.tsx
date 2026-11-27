import { formatDistanceToNowStrict } from "date-fns"
import { enUS, vi } from "date-fns/locale"
import type { SensorNode } from "@/types"
import { devicesDict, type DevicesKey } from "@/constants/devices.i18n"
import { useTranslation } from "@/hooks/common/useTranslation"

// Lý do khởi động lại do ESP32 báo (esp_reset_reason), firmware từ 1.4.0; nhãn nằm trong từ điển 'tech.reset.*'
const RESET_REASON_KEY: Record<string, DevicesKey> = {
  POWERON: "tech.reset.POWERON",
  EXT: "tech.reset.EXT",
  SW: "tech.reset.SW",
  PANIC: "tech.reset.PANIC",
  INT_WDT: "tech.reset.WDT",
  TASK_WDT: "tech.reset.WDT",
  WDT: "tech.reset.WDT",
  DEEPSLEEP: "tech.reset.DEEPSLEEP",
  BROWNOUT: "tech.reset.BROWNOUT",
  SDIO: "tech.reset.SDIO",
}
// Khởi động lại ngoài ý muốn: đáng kiểm tra nguồn/firmware
const UNEXPECTED_RESETS = new Set(["PANIC", "INT_WDT", "TASK_WDT", "WDT", "BROWNOUT"])

function Item({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <dt className="label-caption">{label}</dt>
      <dd className={`mt-1 font-bold tabular-nums ${warn ? "text-climateOrange" : "text-charcoal"}`}>{value}</dd>
    </div>
  )
}

// Thông tin chẩn đoán từ heartbeat gần nhất; firmware cũ không gửi thì hiện "—"
export default function DeviceInfoCard({ node }: { node: SensorNode }) {
  const { t, lang } = useTranslation(devicesDict)
  const online = node.status === "ONLINE" // DEGRADED đã bỏ
  const reason = node.reset_reason
  return (
    <div className="rounded-2xl border border-warmGray/15 bg-white p-5 shadow-sm">
      <h4 className="mb-4 text-small font-bold text-charcoal">{t("tech.info.title")}</h4>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Item label={t("tech.info.firmware")} value={node.firmware_version ? `v${node.firmware_version}` : "—"} />
        <Item
          label={t("tech.info.uptime")}
          value={online && node.booted_at ? formatDistanceToNowStrict(new Date(node.booted_at), { locale: lang === "vi" ? vi : enUS }) : "—"}
        />
        <Item
          label={t("tech.info.lastReset")}
          value={reason ? t(RESET_REASON_KEY[reason] ?? "tech.reset.unknown") : "—"}
          warn={!!reason && UNEXPECTED_RESETS.has(reason)}
        />
        <Item label={t("tech.info.freeMemory")} value={node.free_heap !== undefined ? `${Math.round(node.free_heap / 1024)} KB` : "—"} />
        <Item label={t("tech.info.wifi")} value={node.rssi !== undefined ? `${node.rssi} dBm` : "—"} />
        <Item label={t("tech.info.ip")} value={node.ip ?? "—"} />
      </dl>
    </div>
  )
}
