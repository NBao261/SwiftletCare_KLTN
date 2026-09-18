import { useState, FormEvent } from "react";
import { useFarms, useCreateFarm } from "@/hooks/useFarms";
import { usePermission } from "@/hooks/usePermission";
import { Button, Input, Modal, Card } from "@/components/ui";
import { IconFarm } from "@/components/ui/icons";
import { cn } from "@/utils/cn";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import EmptyState from "@/components/common/EmptyState";
import HouseZoneManager from "./HouseZoneManager";
import FarmMembersManager from "./FarmMembersManager";

const FARM_TABS = ["houses", "members"] as const;
type FarmTab = (typeof FARM_TABS)[number];
const FARM_TAB_LABEL: Record<FarmTab, string> = {
  houses: "Nhà & Zone",
  members: "Thành viên",
};

/** Farms Page – FARM-FR-001, FARM-FR-002 */
export default function FarmsPage() {
  const { data: farms, isLoading } = useFarms();
  const createFarm = useCreateFarm();
  // Backend: POST /farms chỉ cho FARM_OWNER, ADMIN
  const canCreateFarm = usePermission("FARM_OWNER", "ADMIN");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", region: "" });
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FarmTab>("houses");

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    createFarm.mutate(form, {
      onSuccess: () => {
        setShowCreate(false);
        setForm({ name: "", address: "", region: "" });
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-warmGray">
          Quản lý trang trại, nhà yến và khu vực của bạn
        </p>
        {canCreateFarm && (
          <Button onClick={() => setShowCreate(true)}>+ Tạo trang trại</Button>
        )}
      </div>

      {isLoading && <LoadingSkeleton count={2} className="h-28 w-full" />}

      {!isLoading && farms?.length === 0 && (
        <EmptyState
          title="Chưa có trang trại nào"
          description="Tạo farm đầu tiên để bắt đầu quản lý nhà yến, zone và thiết bị."
          action={
            canCreateFarm ? (
              <Button onClick={() => setShowCreate(true)}>
                + Tạo trang trại
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="flex flex-col gap-3">
        {farms?.map((farm) => (
          <Card
            key={farm._id}
            variant={selectedFarmId === farm._id ? "active" : "default"}
          >
            <button
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() =>
                setSelectedFarmId((id) => (id === farm._id ? null : farm._id))
              }
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                    selectedFarmId === farm._id
                      ? "bg-charcoal text-white"
                      : "bg-warmGray/10 text-charcoal",
                  )}
                >
                  <IconFarm />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold">{farm.name}</p>
                  <p className="truncate text-sm text-warmGray">
                    {farm.address}
                    {farm.region ? ` · ${farm.region}` : ""}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold">
                {selectedFarmId === farm._id ? "Thu gọn" : "Quản lý"}
              </span>
            </button>
            {selectedFarmId === farm._id && (
              <div className="mt-4 border-t border-warmGray/15 pt-4">
                <div className="flex gap-1 rounded-2xl bg-warmGray/10 p-1">
                  {FARM_TABS.map((t) => (
                    <button
                      key={t}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTab(t);
                      }}
                      className={cn(
                        "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                        activeTab === t
                          ? "bg-white text-charcoal shadow-card"
                          : "text-warmGray",
                      )}
                    >
                      {FARM_TAB_LABEL[t]}
                    </button>
                  ))}
                </div>
                {activeTab === "houses" ? (
                  <HouseZoneManager farmId={farm._id} farmName={farm.name} />
                ) : (
                  <FarmMembersManager farmId={farm._id} />
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Tạo Farm mới"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input
            label="Tên farm"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="VD: Nhà Yến Minh Phát"
          />
          <Input
            label="Địa chỉ"
            required
            value={form.address}
            onChange={(e) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
          />
          <Input
            label="Khu vực"
            value={form.region}
            onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
            placeholder="VD: HCMC — dùng để phân công kỹ thuật viên phụ trách"
          />
          <Button
            type="submit"
            loading={createFarm.isPending}
            className="w-full"
          >
            Tạo
          </Button>
        </form>
      </Modal>
    </div>
  );
}
