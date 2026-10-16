import { ArrowRightIcon, CheckCircleIcon, CircleIcon, HouseIcon, InfoIcon, WarningIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";
import type { Alert, SystemNodeStatusItem } from "@/types";

/** Phòng của farm (useFarmZones) — chỉ các trường card cần */
interface HouseRoom { _id: string; name: string; floor: number }

type Health = "EMPTY" | "NORMAL" | "ALERT";

/**
 * Cùng bảng màu card nhà yến của Farm Owner (farm-owner/farms/HealthBadge HEALTH_STYLE): xám = chưa có thiết bị,
 * Lime Mist chỉ ở nhãn + dải thông báo khi bình thường, cam = có sự cố. Chép giá trị (không import chéo role).
 */
const HEALTH_STYLE: Record<Health, { badge: string; card: string; iconBox: string; banner: string }> = {
  EMPTY: {
    badge: "border-warmGray/15 bg-warmGray/10 text-warmGray",
    card: "border-warmGray/20",
    iconBox: "bg-warmGray/10 text-warmGray",
    banner: "border-warmGray/15 bg-warmGray/5 text-warmGray",
  },
  NORMAL: {
    badge: "border-success/40 bg-limeMist/30 px-3 text-xs text-accent-900",
    card: "border-warmGray/20",
    iconBox: "bg-warmGray/10 text-charcoal",
    banner: "border-success/30 bg-limeMist/20 text-xs text-accent-900",
  },
  ALERT: {
    badge: "border-orange-600/40 bg-orange-100 text-orange-800",
    card: "border-orange-600/30 shadow-sm",
    iconBox: "bg-orange-100 text-orange-800",
    banner: "border-orange-600/50 bg-orange-100 text-orange-800",
  },
};
const HEALTH_LABEL: Record<Health, string> = { EMPTY: "Chưa có thiết bị", NORMAL: "Bình thường", ALERT: "Cảnh báo" };

/**
 * Card 1 nhà yến (chi tiết Farm của Admin) — bố cục + màu theo card "Cấu trúc Farm" của Farm Owner: icon + tên + số
 * tầng, nhãn sức khoẻ; dải thông báo (cảnh báo mới nhất / thiết bị mất kết nối / bình thường / chưa có thiết bị);
 * 3 ô cảm biến · camera · online; số tầng · phòng; nút capsule "Chi tiết nhà". Bỏ phần chỉ Owner cần (ghim, sản lượng,
 * người phụ trách). Dữ liệu nhẹ do trang cha gom theo nhà (system-status + cảnh báo của 1 farm), không tải cả hệ thống.
 */
export default function HouseCard({ name, floors, rooms, nodes, alerts, onOpen }: {
  name: string;
  floors: number;
  rooms: HouseRoom[];
  nodes: SystemNodeStatusItem[];
  /** Cảnh báo ACTIVE thuộc các phòng của nhà này, mới nhất trước */
  alerts: Alert[];
  onOpen: () => void;
}) {
  const sensors = nodes.filter((n) => n.type === "sensor").length;
  const cameras = nodes.length - sensors;
  const online = nodes.filter((n) => n.status === "ONLINE").length;
  const disconnected = nodes.filter((n) => n.status === "OFFLINE" || n.status === "ERROR");
  const health: Health = nodes.length === 0 ? "EMPTY" : alerts.length || disconnected.length ? "ALERT" : "NORMAL";
  const style = HEALTH_STYLE[health];
  const roomName = (zoneId?: string) => rooms.find((r) => r._id === zoneId)?.name ?? t("Phòng không xác định");

  // Dải thông báo ưu tiên: cảnh báo mới nhất → thiết bị mất kết nối → bình thường / chưa có thiết bị
  const first = alerts[0];
  const issues = alerts.length + (first ? 0 : disconnected.length);
  const banner = first
    ? `${first.title} • ${roomName(first.zone_id)}`
    : disconnected.length
      ? t("{{n}} thiết bị mất kết nối • {{zone}}", { n: disconnected.length, zone: roomName(disconnected[0].zone_id) })
      : health === "EMPTY" ? t("Chưa có thiết bị — chờ kỹ thuật viên lắp đặt") : t("Không có cảnh báo đang mở");

  const stats = [
    { label: "Cảm biến", value: String(sensors), warn: false },
    { label: "Camera", value: String(cameras), warn: false },
    { label: "Đang online", value: `${online}/${nodes.length}`, warn: nodes.length > 0 && online < nodes.length },
  ];

  return (
    <article className={cn("flex flex-col gap-4 rounded-2xl border-2 bg-white p-5", style.card)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.iconBox)}>
            <HouseIcon size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-h3 text-charcoal" title={name}>{name}</h3>
            <p className="truncate text-small text-warmGray">{t("{{n}} tầng", { n: floors })} · {t("{{n}} phòng", { n: rooms.length })}</p>
          </div>
        </div>
        {/* Nhãn luôn kèm chữ + ký hiệu, không chỉ bằng màu */}
        <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-caption", style.badge)}>
          {health === "ALERT" ? <WarningIcon size={12} weight="bold" /> : <CircleIcon size={8} weight={health === "NORMAL" ? "fill" : "bold"} />}
          {t(HEALTH_LABEL[health])}
        </span>
      </div>

      <div className={cn("flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-small", style.banner)}>
        <span className="flex min-w-0 items-center gap-2">
          {health === "ALERT" ? <WarningIcon size={16} className="shrink-0" /> : health === "EMPTY" ? <InfoIcon size={16} className="shrink-0" /> : <CheckCircleIcon size={16} className="shrink-0" />}
          <span className="truncate" title={banner}>{banner}</span>
        </span>
        {issues > 1 && <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-caption">{t("+{{n}} cảnh báo khác", { n: issues - 1 })}</span>}
      </div>

      <div className="grid grid-cols-3 divide-x divide-warmGray/15 rounded-xl border border-warmGray/15">
        {stats.map((s) => (
          <div key={s.label} className="px-3 py-2.5">
            <p className="label-caption truncate">{t(s.label)}</p>
            {/* Chưa có thiết bị → số mờ, không nhầm với "đo được bằng 0" */}
            <p className={cn("mt-0.5 text-h3", health === "EMPTY" ? "text-warmGray/60" : s.warn ? "text-climateOrange" : "text-charcoal")}>
              {health === "EMPTY" ? "—" : s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-auto flex justify-end border-t border-warmGray/10 pt-3">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-warmGray/15 bg-warmGray/5 px-3.5 text-xs font-semibold text-charcoal transition-all hover:bg-charcoal hover:text-white"
        >
          {t("Chi tiết nhà")}
          <ArrowRightIcon size={12} weight="bold" />
        </button>
      </div>
    </article>
  );
}
