import { formatDistanceToNowStrict } from "date-fns"
import { vi } from "date-fns/locale"
import type { SensorNode } from "@/types"

// FARM-FR-006 — lý do khởi động lại do ESP32 báo (esp_reset_reason), firmware ≥ 1.4.0
const RESET_REASON_LABEL: Record<string, string> = {
  POWERON: "Cấp nguồn",
  EXT: "Nút reset",
  SW: "Lệnh khởi động lại / cập nhật firmware",
  PANIC: "Lỗi phần mềm",
  INT_WDT: "Watchdog (treo)",
  TASK_WDT: "Watchdog (treo)",
  WDT: "Watchdog (treo)",
  DEEPSLEEP: "Thức từ ngủ sâu",
  BROWNOUT: "Sụt áp nguồn",
  SDIO: "SDIO",
}
// Khởi động lại ngoài ý muốn — đáng kiểm tra nguồn/firmware
const UNEXPECTED_RESETS = new Set(["PANIC", "INT_WDT", "TASK_WDT", "WDT", "BROWNOUT"])

function Item({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <dt className="label-caption">{label}</dt>
      <dd className={`mt-1 font-bold tabular-nums ${warn ? "text-climateOrange" : "text-charcoal"}`}>{value}</dd>
    </div>
  )
}

/** Thông tin chẩn đoán từ heartbeat gần nhất (FARM-FR-006); firmware cũ không gửi thì hiện "—" */
export default function DeviceInfoCard({ node }: { node: SensorNode }) {
  const online = node.status === "ONLINE" // DEGRADED đã bỏ (SRS 3.1.0)
  const reason = node.reset_reason
  return (
    <div className="rounded-2xl border border-warmGray/15 bg-white p-5 shadow-sm">
      <h4 className="mb-4 text-small font-bold text-charcoal">Thông tin thiết bị</h4>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Item label="Firmware" value={node.firmware_version ? `v${node.firmware_version}` : "—"} />
        <Item
          label="Chạy liên tục"
          value={online && node.booted_at ? formatDistanceToNowStrict(new Date(node.booted_at), { locale: vi }) : "—"}
        />
        <Item
          label="Khởi động lại gần nhất do"
          value={reason ? RESET_REASON_LABEL[reason] ?? "Không rõ" : "—"}
          warn={!!reason && UNEXPECTED_RESETS.has(reason)}
        />
        <Item label="Bộ nhớ trống" value={node.free_heap !== undefined ? `${Math.round(node.free_heap / 1024)} KB` : "—"} />
        <Item label="Wi-Fi" value={node.rssi !== undefined ? `${node.rssi} dBm` : "—"} />
        <Item label="Địa chỉ IP" value={node.ip ?? "—"} />
      </dl>
    </div>
  )
}
