import { useState, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFarm, useHouses, useCreateHouse } from "@/hooks/shared/useFarms";
import { usePermission } from "@/hooks/common/usePermission";
import { usePageBreadcrumb } from "@/hooks/common/useBreadcrumb";
import { Button, Input, Modal, Card } from "@/components/ui";
import { IconChevronRight } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import FarmMembersManager from "@/components/features/farm-owner/farms/FarmMembersManager";

const FARM_TABS = ["houses", "members"] as const;
type FarmTab = (typeof FARM_TABS)[number];
const FARM_TAB_LABEL: Record<FarmTab, string> = {
  houses: "Nhà & Zone",
  members: "Thành viên",
};

/** Chi tiết 1 Farm (/farms/:farmId) — danh sách House, bấm 1 house để drill-down sang /farms/:farmId/houses/:houseId */
export default function FarmOwnerFarmHousesPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: farm, isLoading: isLoadingFarm } = useFarm(farmId);
  const { data: houses, isLoading: isLoadingHouses } = useHouses(farmId);
  const createHouse = useCreateHouse(farmId!);
  // Backend: POST /farms/:id/houses chỉ cho FARM_OWNER, TECHNICIAN, ADMIN
  const canManage = usePermission("FARM_OWNER", "TECHNICIAN", "ADMIN");
  const [activeTab, setActiveTab] = useState<FarmTab>("houses");
  const [showCreateHouse, setShowCreateHouse] = useState(false);
  const [houseName, setHouseName] = useState("");

  usePageBreadcrumb(farm ? [{ label: farm.name }] : []);

  function handleCreateHouse(e: FormEvent) {
    e.preventDefault();
    createHouse.mutate(
      { name: houseName },
      {
        onSuccess: () => {
          setShowCreateHouse(false);
          setHouseName("");
        },
      },
    );
  }

  if (isLoadingFarm) return <LoadingSkeleton className="h-28 w-full" />;
  if (!farm) return <EmptyState title="Không tìm thấy trang trại" description="Trang trại có thể đã bị xoá hoặc bạn không có quyền xem." />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="truncate text-2xl font-bold tracking-tight text-charcoal">{farm.name}</p>
        <p className="truncate text-sm text-warmGray">
          {farm.address}
          {farm.region ? ` · ${farm.region}` : ""}
        </p>
      </div>

      <div className="flex gap-1 rounded-2xl bg-warmGray/10 p-1">
        {FARM_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
              activeTab === t ? "bg-white text-charcoal shadow-card" : "text-warmGray",
            )}
          >
            {FARM_TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {activeTab === "houses" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-warmGray">Nhà yến (House)</h3>
            {canManage && (
              <Button variant="secondary" size="sm" onClick={() => setShowCreateHouse(true)}>
                + Thêm nhà
              </Button>
            )}
          </div>

          {isLoadingHouses && <LoadingSkeleton count={2} className="h-16 w-full" />}
          {!isLoadingHouses && houses?.length === 0 && (
            <EmptyState
              title="Chưa có nhà yến nào"
              description="Thêm nhà yến đầu tiên để bắt đầu tạo Zone và gắn thiết bị."
            />
          )}

          {houses?.map((house) => (
            <Card key={house._id}>
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => navigate(`/farms/${farmId}/houses/${house._id}`)}
              >
                <span className="font-semibold text-charcoal">{house.name}</span>
                <IconChevronRight width={18} height={18} className="shrink-0 text-warmGray" />
              </button>
            </Card>
          ))}
        </div>
      ) : (
        <FarmMembersManager farmId={farmId!} />
      )}

      <Modal open={showCreateHouse} onClose={() => setShowCreateHouse(false)} title="Thêm nhà yến">
        <form onSubmit={handleCreateHouse} className="flex flex-col gap-4">
          <Input
            label="Tên nhà"
            required
            value={houseName}
            onChange={(e) => setHouseName(e.target.value)}
            placeholder="VD: Nhà chính"
          />
          <Button type="submit" loading={createHouse.isPending} className="w-full">
            Tạo
          </Button>
        </form>
      </Modal>
    </div>
  );
}
