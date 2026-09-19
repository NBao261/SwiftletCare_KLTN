import { useState, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFarm, useHouses, useZones, useCreateZone } from "@/hooks/useFarms";
import { useZoneStore } from "@/store/zoneStore";
import { usePermission } from "@/hooks/usePermission";
import { usePageBreadcrumb } from "@/hooks/useBreadcrumb";
import { Button, Input, Modal } from "@/components/ui";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import EmptyState from "@/components/common/EmptyState";

/** Danh sách Zone của 1 House (/farms/:farmId/houses/:houseId) — FARM-FR-002 */
export default function FarmZonesPage() {
  const { farmId, houseId } = useParams<{ farmId: string; houseId: string }>();
  const navigate = useNavigate();
  const { data: farm } = useFarm(farmId);
  // Không có API lấy 1 house theo id — tra trong danh sách house của farm (đã fetch sẵn ở trang cha, cache lại nhờ react-query)
  const { data: houses } = useHouses(farmId);
  const house = houses?.find((h) => h._id === houseId);
  const { data: zones, isLoading } = useZones(houseId);
  const createZone = useCreateZone(houseId!);
  // Backend: POST /farms/houses/:houseId/zones chỉ cho FARM_OWNER, TECHNICIAN, ADMIN
  const canManage = usePermission("FARM_OWNER", "TECHNICIAN", "ADMIN");
  // Route /dashboard chỉ cho FARM_OWNER (RequireRole trong App.tsx) — nút này chỉ hiện cho role được vào
  const canViewDashboard = usePermission("FARM_OWNER");
  const setZone = useZoneStore((s) => s.setZone);
  const [showCreate, setShowCreate] = useState(false);
  const [zoneName, setZoneName] = useState("");

  usePageBreadcrumb(
    farm && house
      ? [{ label: farm.name, onClick: () => navigate(`/farms/${farmId}`) }, { label: house.name }]
      : [],
  );

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    createZone.mutate(
      { name: zoneName },
      {
        onSuccess: () => {
          setShowCreate(false);
          setZoneName("");
        },
      },
    );
  }

  function goTo(zoneId: string, zoneName: string, path: string) {
    setZone(farmId!, farm?.name ?? "", zoneId, zoneName);
    navigate(path);
  }

  if (!house) return <LoadingSkeleton className="h-28 w-full" />;

  return (
    <div className="flex flex-col gap-6">
      <p className="truncate text-2xl font-bold tracking-tight text-charcoal">{house.name}</p>

      <div className="flex items-center justify-between">
        <span className="label-caption">Zone</span>
        {canManage && (
          <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)}>
            + Thêm zone
          </Button>
        )}
      </div>

      {isLoading && <LoadingSkeleton className="h-10 w-full" />}
      {!isLoading && zones?.length === 0 && (
        <EmptyState title="Chưa có zone nào" description="Thêm zone đầu tiên để gắn thiết bị và theo dõi môi trường." />
      )}

      <div className="flex flex-col gap-2">
        {zones?.map((zone) => (
          <div key={zone._id} className="flex items-center justify-between rounded-xl bg-warmGray/5 px-4 py-2.5">
            <span className="text-sm font-medium text-charcoal">{zone.name}</span>
            <div className="flex gap-2">
              {canViewDashboard && (
                <Button variant="secondary" size="sm" onClick={() => goTo(zone._id, zone.name, "/dashboard")}>
                  Dashboard
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => goTo(zone._id, zone.name, "/devices")}>
                Thiết bị
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Thêm Zone">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input
            label="Tên zone"
            required
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            placeholder="VD: Tầng 1"
          />
          <Button type="submit" loading={createZone.isPending} className="w-full">
            Tạo
          </Button>
        </form>
      </Modal>
    </div>
  );
}
