import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFarm, useHouses, useFarmZones } from "@/hooks/shared/useFarms";
import { usePageBreadcrumb, usePageBack } from "@/hooks/common/useBreadcrumb";
import { useSystemNodeStatus } from "@/hooks/shared/useDevices";
import { useAlertsList } from "@/hooks/shared/useAlerts";
import { SectionCard } from "@/components/ui";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import FarmRecentTickets from "@/components/features/admin/farms/FarmRecentTickets";
import HouseCard from "@/components/features/admin/farms/HouseCard";
import FarmMembersPanel from "@/components/features/admin/farms/FarmMembersPanel";
import { cn } from "@/lib/cn";
import { tr } from "@/i18n";

type FarmTab = "houses" | "members";
const TABS: { key: FarmTab; label: string }[] = [
  { key: "houses", label: "Nhà yến" },
  { key: "members", label: "Thành viên" },
];

/**
 * Chi tiết 1 Farm cho Admin (/system/farms/:farmId) — FARM-FR-009: cấu trúc (nhà/phòng) + người dùng + ticket liên
 * quan. Cùng ngôn ngữ các trang Admin khác: card trắng không icon, màu trung tính. Card trên 2 tab: Nhà yến (HouseCard) |
 * Thành viên (chủ nhà yến + chuyên gia, chỉ xem); card dưới: ticket gần nhất. Chỉ xem cấu trúc — tạo nhà là việc của Farm Owner/Technician lúc lắp đặt; Admin không
 * sửa/xoá farm.
 */
export default function AdminFarmDetailPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<FarmTab>("houses");
  const { data: farm, isLoading: isLoadingFarm } = useFarm(farmId);
  const { data: houses, isLoading: isLoadingHouses } = useHouses(farmId);
  // Không có API đếm phòng theo nhà — dùng lại danh sách zone phẳng của farm (đã cache, ZonePicker cũng gọi)
  const { data: farmZones } = useFarmZones(farmId);
  // Dữ liệu cho card nhà yến: thiết bị (system-status có zone_id) và cảnh báo đang mở
  const nodeStatus = useSystemNodeStatus();
  const { records: activeAlerts } = useAlertsList({ farmId, status: "ACTIVE", limit: 100 });

  usePageBreadcrumb(farm ? [{ label: farm.name }] : []);
  usePageBack("/system/farms", "danh sách trang trại");

  if (isLoadingFarm) return <LoadingSkeleton className="h-28 w-full" />;
  if (!farm) return <EmptyState title="Không tìm thấy trang trại" description="Trang trại có thể đã bị xoá." />;

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title={farm.name}
        description={<p className="truncate">{farm.address}{farm.region ? ` · ${farm.region}` : ""}</p>}
        // Tab pill cùng kiểu trang Ticket / Người dùng
        action={
          <div className="inline-flex gap-1 rounded-full bg-warmGray/10 p-1" role="tablist" aria-label={tr("Nội dung trang trại")}>
            {TABS.map((x) => (
              <button
                key={x.key}
                type="button"
                role="tab"
                aria-selected={tab === x.key}
                onClick={() => setTab(x.key)}
                className={cn(
                  "h-9 whitespace-nowrap rounded-full px-4 text-small font-semibold transition-colors duration-150",
                  tab === x.key ? "bg-white text-charcoal shadow-card" : "text-warmGray hover:text-charcoal",
                )}
              >
                {tr(x.label)}
              </button>
            ))}
          </div>
        }
      >
        {tab === "members" ? <FarmMembersPanel farm={farm} /> : (
        /* Lưới card 2 cột — mỗi nhà 1 HouseCard (trạng thái cảnh báo, thiết bị) */
        <div className="grid gap-4 md:grid-cols-2">
            {isLoadingHouses && <LoadingSkeleton count={2} className="h-64 w-full" />}
            {!isLoadingHouses && houses?.length === 0 && (
              <p className="col-span-full rounded-2xl border border-warmGray/15 py-6 text-center text-sm text-warmGray">
                {tr("Chưa có nhà yến nào — Farm Owner hoặc Technician tạo khi lắp đặt.")}
              </p>
            )}
            {houses?.map((house) => {
              const rooms = farmZones?.filter((z) => z.house_id === house._id) ?? [];
              const inHouse = (zoneId?: string) => !!zoneId && rooms.some((r) => r._id === zoneId);
              return (
                <HouseCard
                  key={house._id}
                  name={house.name}
                  floors={house.floors}
                  rooms={rooms}
                  nodes={(nodeStatus.data?.nodes ?? []).filter((n) => inHouse(n.zone_id))}
                  alerts={activeAlerts.filter((a) => inHouse(a.zone_id))}
                  onOpen={() => navigate(`/system/farms/${farmId}/houses/${house._id}`)}
                />
              );
            })}
        </div>
        )}
      </SectionCard>

      <FarmRecentTickets farmId={farmId!} />
    </div>
  );
}
