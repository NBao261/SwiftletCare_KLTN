import { useState, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CpuIcon, SquaresFourIcon, VideoCameraIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useFarm, useHouses, useZones } from "@/hooks/shared/useFarms";
import { useSystemNodeStatus } from "@/hooks/shared/useDevices";
import { usePageBreadcrumb, usePageBack } from "@/hooks/common/useBreadcrumb";
import { Button, EmptyState } from "@/components/ui";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import StatusDot from "@/components/common/StatusDot";
import { formatRelativeTime } from "@/lib/helpers";
import { cn } from "@/lib/cn";
import { t, tr, trChildren } from "@/i18n";
import type { SystemNodeStatusItem } from "@/types";

/** Nhóm nền xám chia dòng — cùng kiểu Group của popup Chi tiết tài khoản */
function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h4 className="mb-2 text-body font-semibold text-charcoal">{tr(title)}</h4>}
      <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-gray-50 px-4">{children}</div>
    </section>
  );
}

/** "07/10/2026 20:34:30" — lần kết nối cuối đủ ngày giờ phút giây, giờ VN (ghép tay: vi-VN mặc định đặt giờ trước ngày) */
const DAY = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })
const TIME = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
const dateTime = (iso: string) => `${DAY.format(new Date(iso))} ${TIME.format(new Date(iso))}`

/**
 * 1 thiết bị — cùng kiểu ô Thiết bị bảng Farm Owner (DeviceListTable): icon + tên loại thiết bị đậm + mã thiết bị
 * cùng hàng; dòng dưới là tín hiệu · lần kết nối cuối (đủ ngày giờ); trạng thái (màu) bên phải
 */
function DeviceRow({ node }: { node: SystemNodeStatusItem }) {
  const isSensor = node.type === "sensor";
  const signal = node.rssi !== undefined ? t("Tín hiệu {{rssi}} dBm", { rssi: node.rssi }) : null
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warmGray/10 text-charcoal">
          {isSensor ? <CpuIcon size={18} /> : <VideoCameraIcon size={18} />}
        </span>
        <div className="min-w-0">
          {/* Tên loại thiết bị + mã thiết bị cùng hàng (mã dạng chip xám như bảng thiết bị Farm Owner) */}
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate text-body font-semibold text-charcoal">{t(isSensor ? "Node cảm biến môi trường" : "Camera AI đếm chim")}</span>
            <span className="shrink-0 rounded-lg bg-warmGray/10 px-2 py-0.5 text-xs text-graphite" title={t("Mã thiết bị")}>{node.device_id}</span>
          </p>
          {(signal || node.last_heartbeat) && (
            <p className="truncate text-xs text-warmGray" title={node.last_heartbeat && formatRelativeTime(node.last_heartbeat)}>
              {signal}
              {signal && node.last_heartbeat && " · "}
              {/* Ngày giờ kết nối cuối in đậm — mốc Admin cần đọc nhanh */}
              {node.last_heartbeat && <>{t("Kết nối lần cuối")} <span className="font-semibold text-charcoal">{dateTime(node.last_heartbeat)}</span></>}
            </p>
          )}
        </div>
      </div>
      <StatusDot status={node.status} colored className="shrink-0 text-small" />
    </div>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="py-3 text-body italic text-warmGray">{trChildren(children)}</p>;

/**
 * Phòng (= Zone ở backend) của 1 nhà yến cho Admin (/system/farms/:farmId/houses/:houseId) — FARM-FR-002/009.
 * Bố cục ngang 2 cột như các popup Admin (Chi tiết tài khoản), nhưng hiển thị ngay trên trang: trái = tên nhà + danh
 * sách tầng (1..house.floors, tầng trống ghi "Chưa có phòng" = chưa được giám sát), phải = từng phòng của tầng đang
 * chọn là 1 nhóm nền xám (phòng có thiết bị lên trước), mỗi thiết bị 1 dòng (trạng thái, tín hiệu, lần kết nối cuối).
 * Chỉ xem như trang farm cha — tạo phòng/gán thiết bị là việc của Farm Owner/Technician. Không có nút Dashboard:
 * route /dashboard chỉ cho Farm Owner.
 */
export default function AdminFarmHousePage() {
  const { farmId, houseId } = useParams<{ farmId: string; houseId: string }>();
  const navigate = useNavigate();
  const [selectedFloor, setSelectedFloor] = useState(1);
  const { data: farm } = useFarm(farmId);
  // Không có API lấy 1 house theo id — tra trong danh sách house của farm (đã fetch sẵn ở trang cha, cache lại nhờ react-query)
  const houses = useHouses(farmId);
  const house = houses.data?.find((h) => h._id === houseId);
  const zones = useZones(houseId);
  const rooms = zones.data;
  // Cùng nguồn với trang Thiết bị của Admin (GET /devices/system-status, có zone_id) — lọc theo phòng của nhà này
  const nodeStatus = useSystemNodeStatus();

  usePageBreadcrumb(
    farm && house
      ? [{ label: farm.name, onClick: () => navigate(`/system/farms/${farmId}`) }, { label: house.name }]
      : [],
  );
  usePageBack(`/system/farms/${farmId}`, farm?.name ?? "trang trại");

  if (houses.isLoading) return <LoadingSkeleton className="h-28 w-full" />;
  if (houses.isError || zones.isError) {
    return (
      <EmptyState
        icon={<WarningCircleIcon size={32} />}
        title="Không tải được thông tin nhà yến"
        description="Kiểm tra kết nối tới máy chủ rồi thử lại."
        action={
          <Button variant="secondary" size="sm" onClick={() => { houses.refetch(); zones.refetch(); }}>
            Thử lại
          </Button>
        }
      />
    );
  }
  if (!house) return <EmptyState title="Không tìm thấy nhà yến" description="Nhà yến có thể đã bị xoá hoặc đường dẫn không đúng." />;

  // Phòng cũ có thể nằm ở tầng > house.floors (dữ liệu seed) — mở rộng để không phòng nào bị ẩn
  const floorCount = Math.max(house.floors, ...(rooms ?? []).map((r) => r.floor));
  const floors = Array.from({ length: floorCount }, (_, i) => i + 1);
  const floor = Math.min(selectedFloor, floorCount);
  const nodes = (nodeStatus.data?.nodes ?? []).filter((n) => rooms?.some((r) => r._id === n.zone_id));
  const roomNodes = (zoneId: string) => nodes.filter((n) => n.zone_id === zoneId);
  // Phòng có thiết bị lên trước, phòng "Chưa có thiết bị" xuống cuối (sort ổn định — giữ thứ tự gốc trong mỗi nhóm)
  const floorRooms = (rooms?.filter((r) => r.floor === floor) ?? [])
    .sort((a, b) => Number(roomNodes(b._id).length > 0) - Number(roomNodes(a._id).length > 0));
  // Trang thiết bị Admin (chỉ xem) lọc theo tên farm — mở sẵn đúng farm này
  const devicesUrl = `/system/devices?farm=${encodeURIComponent(farm?.name ?? "")}`;

  return (
    // Cùng khung SectionCard (viền + bóng), bên trong là bố cục 2 cột kiểu popup. flex-1: khung trắng kéo dài tới cuối
    // vùng nội dung (AppShell là flex-col min-h-full) — đổi tầng / ít phòng không làm card ngắn lại
    <section className="flex min-h-[24rem] flex-1 flex-col gap-6 rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card md:flex-row">
      {/* Cột trái: tên nhà + tầng */}
      <nav className="flex shrink-0 flex-col gap-1 border-b border-gray-200 pb-4 md:w-56 md:border-b-0 md:border-r md:pb-0 md:pr-4" aria-label={t("Tầng")}>
        <div className="mb-3 min-w-0">
          <p className="truncate text-lg font-bold text-charcoal" title={house.name}>{house.name}</p>
          <p className="truncate text-small text-warmGray">
            {t("{{floors}} tầng · {{rooms}} phòng · {{devices}} thiết bị", { floors: house.floors, rooms: rooms?.length ?? 0, devices: nodes.length })}
          </p>
        </div>
        {floors.map((f) => {
          const count = rooms?.filter((r) => r.floor === f).length ?? 0;
          return (
            <button
              key={f}
              type="button"
              aria-current={floor === f ? "page" : undefined}
              onClick={() => setSelectedFloor(f)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-body transition-colors duration-150",
                // Tầng đang xem nền đen chữ trắng — cùng kiểu mục đang chọn ở popup Tạo ticket / Chi tiết tài khoản
                floor === f ? "bg-charcoal font-semibold text-white" : "text-graphite hover:bg-gray-100",
              )}
            >
              {t("Tầng {{n}}", { n: f })}
              {/* Số phòng; tầng trống "Chưa có phòng" in nghiêng. Chữ phụ đổi màu theo nền (trắng mờ trên nền đen) */}
              <span className={cn("text-xs font-normal", floor === f ? "text-white/70" : "text-warmGray", !count && "italic")}>
                {count ? t("{{n}} phòng", { n: count }) : t("Chưa có phòng")}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Cột phải: mỗi phòng 1 nhóm thiết bị — không lặp tiêu đề tầng (đã sáng ở menu trái) */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex min-h-9 justify-end">
          <Button variant="secondary" size="sm" onClick={() => navigate(devicesUrl)}>
            Thiết bị & Cảm biến
          </Button>
        </div>

        {zones.isLoading || nodeStatus.isLoading ? (
          <LoadingSkeleton count={2} className="h-20 w-full" />
        ) : floorRooms.length === 0 ? (
          // Tầng trống: khung xám lớn có viền + icon ở giữa — nhìn là biết tầng này chưa có phòng nào được giám sát
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warmGray/10 text-warmGray">
              <SquaresFourIcon size={24} />
            </span>
            <div>
              <p className="text-body font-semibold text-charcoal">{t("Chưa có phòng")}</p>
              <p className="mt-1 text-small italic text-warmGray">{t("Tầng này chưa được giám sát.")}</p>
            </div>
          </div>
        ) : (
          floorRooms.map((room) => {
            const list = roomNodes(room._id);
            return (
              <Group key={room._id} title={t("Khu {{name}}", { name: room.name })}>
                {list.length ? list.map((n) => <DeviceRow key={n._id} node={n} />) : <Empty>Chưa có thiết bị</Empty>}
              </Group>
            );
          })
        )}
      </div>
    </section>
  );
}
