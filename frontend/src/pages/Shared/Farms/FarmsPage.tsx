import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useFarms, useCreateFarm } from "@/hooks/useFarms";
import { usePermission } from "@/hooks/usePermission";
import { Button, Input, Modal, Card } from "@/components/ui";
import { IconFarm, IconChevronRight } from "@/components/ui/icons";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import EmptyState from "@/components/common/EmptyState";

/** Farms Page – FARM-FR-001, FARM-FR-002 — danh sách farm, bấm 1 farm để drill-down sang /farms/:farmId */
export default function FarmsPage() {
  const { data: farms, isLoading } = useFarms();
  const createFarm = useCreateFarm();
  const navigate = useNavigate();
  // Backend: POST /farms chỉ cho FARM_OWNER, ADMIN
  const canCreateFarm = usePermission("FARM_OWNER", "ADMIN");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", region: "" });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    createFarm.mutate(form, {
      onSuccess: (res) => {
        setShowCreate(false);
        setForm({ name: "", address: "", region: "" });
        navigate(`/farms/${res.data.data._id}`);
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
          <Card key={farm._id}>
            <button
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => navigate(`/farms/${farm._id}`)}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-warmGray/10 text-charcoal">
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
              <IconChevronRight width={18} height={18} className="shrink-0 text-warmGray" />
            </button>
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
