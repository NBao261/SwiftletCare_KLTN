import { ArrowRightIcon, CheckCircleIcon, HouseIcon, WarningIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { t } from "@/i18n";
import type { Alert, SystemNodeStatusItem } from "@/types";

/** Phòng của farm (useFarmZones) — chỉ các trường card cần */
interface HouseRoom { _id: string; floor: number }

/**
 * Card 1 nhà yến ở tab "Nhà yến" (chi tiết Farm của Admin): đầu card tên + số tầng + nhãn Bình thường/Cảnh báo;
 * dải cảnh báo đang mở (cảnh báo đầu + số còn lại) hoặc "Không có cảnh báo đang mở"; ô số cảm biến / camera / online;
 * chân card số phòng + link Chi tiết nhà.
 * Chỉ ĐỌC — số liệu do trang cha gom sẵn theo nhà (thiết bị, cảnh báo).
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
  const first = alerts[0];
  const firstFloor = first?.zone_id ? rooms.find((r) => r._id === first.zone_id)?.floor : undefined;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-warmGray/15 bg-white p-4 shadow-card">
      {/* Đầu card: icon nhà + tên + số tầng · nhãn trạng thái */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warmGray/10 text-charcoal">
            <HouseIcon size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-charcoal" title={name}>{name}</p>
            <p className="text-xs text-warmGray">{t("{{n}} tầng", { n: floors })}</p>
          </div>
        </div>
        <Badge tone={first ? "warning" : "neutral"} className="shrink-0">{first ? "Cảnh báo" : "Bình thường"}</Badge>
      </div>

      {/* Dải cảnh báo: có cảnh báo đang mở → cam (cảnh báo mới nhất + tầng + số còn lại); không → xám nhạt */}
      {first ? (
        <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">
          <WarningIcon size={16} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate" title={first.title}>
            {first.title}
            {firstFloor != null && ` • ${t("Tầng {{n}}", { n: firstFloor })}`}
          </span>
          {alerts.length > 1 && <span className="shrink-0 text-xs">{t("+{{n}} cảnh báo khác", { n: alerts.length - 1 })}</span>}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-graphite">
          <CheckCircleIcon size={16} className="shrink-0" />
          {t("Không có cảnh báo đang mở")}
        </div>
      )}

      {/* 3 ô số: cảm biến / camera / đang online (cam khi có thiết bị chưa online) */}
      <dl className="grid grid-cols-3 divide-x divide-gray-200 rounded-xl border border-gray-200">
        {([
          ["Cảm biến", String(sensors), false],
          ["Camera", String(cameras), false],
          ["Đang online", `${online}/${nodes.length}`, nodes.length > 0 && online < nodes.length],
        ] as const).map(([label, value, warn]) => (
          <div key={label} className="px-3 py-2.5">
            <dt className="text-xs text-warmGray">{t(label)}</dt>
            <dd className={cn("text-lg font-semibold", warn ? "text-orange-600" : "text-charcoal")}>{value}</dd>
          </div>
        ))}
      </dl>

      {/* Chân card: số phòng bên trái, link chữ "Chi tiết nhà →" bên phải (không khung viền) */}
      <div className="mt-auto flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-warmGray">{t("{{n}} phòng", { n: rooms.length })}</p>
        <button
          type="button"
          onClick={onOpen}
          className="group inline-flex shrink-0 items-center gap-1 text-small font-semibold text-charcoal hover:underline"
        >
          {t("Chi tiết nhà")}
          <ArrowRightIcon size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
