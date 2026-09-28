import { useParams, useNavigate } from "react-router-dom";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { useFarm, useHouses, useZones } from "@/hooks/shared/useFarms";
import { usePageBreadcrumb, usePageBack } from "@/hooks/common/useBreadcrumb";
import { Button, EmptyState } from "@/components/ui";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";

/**
 * Phòng (= Zone ở backend) của 1 nhà yến cho Admin (/system/farms/:farmId/houses/:houseId) —
 * FARM-FR-002/009, nhóm theo tầng (1..house.floors) để thấy ngay tầng nào chưa có phòng,
 * tức chưa được giám sát. Chỉ xem như trang farm cha — tạo phòng là việc của Farm Owner/Technician.
 * Không có nút Dashboard: route /dashboard chỉ cho Farm Owner.
 */
export default function AdminFarmHousePage() {
  const { farmId, houseId } = useParams<{ farmId: string; houseId: string }>();
  const navigate = useNavigate();
  const { data: farm } = useFarm(farmId);
  // Không có API lấy 1 house theo id — tra trong danh sách house của farm (đã fetch sẵn ở trang cha, cache lại nhờ react-query)
  const houses = useHouses(farmId);
  const house = houses.data?.find((h) => h._id === houseId);
  const zones = useZones(houseId);
  const rooms = zones.data;

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
  const emptyFloors = floors.filter((f) => !rooms?.some((r) => r.floor === f)).length;
  // Trang thiết bị Admin (chỉ xem) lọc theo tên farm — mở sẵn đúng farm này
  const devicesUrl = `/system/devices?farm=${encodeURIComponent(farm?.name ?? "")}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="truncate text-2xl font-bold tracking-tight text-charcoal">{house.name}</p>
          <p className="text-sm text-warmGray">
            {house.floors} tầng · {rooms?.length ?? 0} phòng
            {!zones.isLoading && emptyFloors > 0 && (
              <span className="font-semibold text-orange-600"> · {emptyFloors} tầng chưa có phòng</span>
            )}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate(devicesUrl)}>
          Thiết bị & Cảm biến
        </Button>
      </div>

      {zones.isLoading && <LoadingSkeleton count={2} className="h-16 w-full" />}

      {!zones.isLoading &&
        floors.map((floor) => {
          const floorRooms = rooms?.filter((r) => r.floor === floor) ?? [];
          return (
            <section key={floor} className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-bold text-charcoal">Tầng {floor}</h3>
                <span className="text-xs text-warmGray">{floorRooms.length} phòng</span>
              </div>

              {floorRooms.length === 0 ? (
                <div className="rounded-xl border border-dashed border-warmGray/30 px-4 py-3">
                  <span className="text-sm text-warmGray">Chưa có phòng — tầng này chưa được giám sát.</span>
                </div>
              ) : (
                floorRooms.map((room) => (
                  <div key={room._id} className="rounded-xl bg-warmGray/5 px-4 py-2.5">
                    <span className="text-sm font-medium text-charcoal">{room.name}</span>
                  </div>
                ))
              )}
            </section>
          );
        })}
    </div>
  );
}
