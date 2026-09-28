import { useParams, useNavigate } from "react-router-dom";
import { useFarm, useHouses, useFarmZones } from "@/hooks/shared/useFarms";
import { usePageBreadcrumb, usePageBack } from "@/hooks/common/useBreadcrumb";
import { Card } from "@/components/ui";
import { IconChevronRight, IconFarm } from "@/components/ui/icons";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import FarmMembersCard from "@/components/features/admin/farms/FarmMembersCard";
import FarmRecentTickets from "@/components/features/admin/farms/FarmRecentTickets";

/**
 * Chi tiết 1 Farm cho Admin (/system/farms/:farmId) — FARM-FR-009: cấu trúc (nhà/phòng)
 * + người dùng + ticket liên quan, 1 màn không tab: hàng trên Nhà yến (lime) + Thành viên
 * (charcoal), hàng dưới ticket gần nhất. Chỉ xem cấu trúc — tạo nhà là việc của Farm
 * Owner/Technician lúc lắp đặt; Admin không sửa/xoá farm (không FR nào yêu cầu).
 */
export default function AdminFarmDetailPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: farm, isLoading: isLoadingFarm } = useFarm(farmId);
  const { data: houses, isLoading: isLoadingHouses } = useHouses(farmId);
  // Không có API đếm phòng theo nhà — dùng lại danh sách zone phẳng của farm (đã cache, ZonePicker cũng gọi)
  const { data: farmZones } = useFarmZones(farmId);

  usePageBreadcrumb(farm ? [{ label: farm.name }] : []);
  usePageBack("/system/farms", "danh sách trang trại");

  if (isLoadingFarm) return <LoadingSkeleton className="h-28 w-full" />;
  if (!farm) return <EmptyState title="Không tìm thấy trang trại" description="Trang trại có thể đã bị xoá." />;

  return (
    <div className="flex flex-col gap-6">
      {/* 1 khung trắng: thông tin farm + cặp card Nhà yến/Thành viên — cùng khuôn card các trang Admin (icon như mục menu sidebar) */}
      <section className="flex flex-col gap-5 rounded-2xl border border-warmGray/15 bg-white p-5 shadow-card">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-charcoal text-limeMist">
            <IconFarm width={20} height={20} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-2xl font-bold tracking-tight text-charcoal">{farm.name}</p>
            <p className="truncate text-sm text-warmGray">
              {farm.address}
              {farm.region ? ` · ${farm.region}` : ""}
            </p>
            {/* GET /farms/:id đã populate owner — không tốn request thêm */}
            {farm.owner?.full_name && (
              <p className="mt-1 truncate text-sm text-graphite">
                Chủ sở hữu: <span className="font-semibold text-charcoal">{farm.owner.full_name}</span>
                {farm.owner.email && <span className="text-warmGray"> ({farm.owner.email})</span>}
              </p>
            )}
          </div>
        </div>

        {/* Cặp card lime (trái) / charcoal (phải) — cùng ngôn ngữ với SlaCard/ThresholdsCard ở AdminSystemSettingsPage; grid stretch để 2 card cao bằng nhau.
            Không bóng: đã nằm trong khung trắng */}
        <div className="grid gap-5 lg:grid-cols-2">
          <Card variant="active" size="lg" className="flex flex-col gap-3 p-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <h2 className="font-bold text-charcoal">Nhà yến</h2>
              {!!houses?.length && (
                <span className="shrink-0 rounded-full bg-charcoal/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-charcoal/70">
                  {houses.length} nhà
                </span>
              )}
            </div>

            {isLoadingHouses && <LoadingSkeleton count={2} className="h-14 w-full bg-charcoal/10" />}
            {!isLoadingHouses && houses?.length === 0 && (
              <p className="rounded-2xl border border-dashed border-charcoal/20 px-4 py-6 text-center text-sm text-charcoal/70">
                Chưa có nhà yến nào — Farm Owner hoặc Technician tạo khi lắp đặt.
              </p>
            )}

            {houses?.map((house) => {
              const houseRooms = farmZones?.filter((z) => z.house_id === house._id);
              // Tầng 1..floors chưa có phòng nào = chưa được giám sát (cùng cách tính với AdminFarmHousePage)
              const emptyFloors = houseRooms
                ? Array.from({ length: house.floors }, (_, i) => i + 1).filter((f) => !houseRooms.some((z) => z.floor === f)).length
                : 0;
              return (
                <button
                  key={house._id}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left transition-shadow hover:shadow-card"
                  onClick={() => navigate(`/system/farms/${farmId}/houses/${house._id}`)}
                >
                  {/* Icon-box tròn lime — cùng kiểu panel trong ThresholdsCard */}
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-limeMist text-charcoal">
                    <IconFarm width={18} height={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-charcoal">{house.name}</p>
                    <p className="truncate text-xs text-warmGray">
                      {house.floors} tầng
                      {houseRooms && ` · ${houseRooms.length} phòng`}
                      {emptyFloors > 0 && (
                        <span className="font-semibold text-orange-600"> · {emptyFloors} tầng chưa có phòng</span>
                      )}
                      {house.description && ` · ${house.description}`}
                    </p>
                  </div>
                  <IconChevronRight width={18} height={18} className="shrink-0 text-warmGray" />
                </button>
              );
            })}
          </Card>
          <FarmMembersCard farmId={farmId!} />
        </div>
      </section>

      <FarmRecentTickets farmId={farmId!} />
    </div>
  );
}
