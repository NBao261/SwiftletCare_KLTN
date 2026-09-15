import { useState, FormEvent } from "react";
import { useFarms, useCreateFarm } from "@/hooks/useFarms";
import { Button, Input, Modal, Card } from "@/components/ui";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import EmptyState from "@/components/common/EmptyState";
import HouseZoneManager from "./HouseZoneManager";

/** Farms Page – FARM-FR-001, FARM-FR-002 */
export default function FarmsPage() {
  const { data: farms, isLoading } = useFarms();
  const createFarm = useCreateFarm();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", address: "" });
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    createFarm.mutate(form, {
      onSuccess: () => {
        setShowCreate(false);
        setForm({ name: "", address: "" });
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Trang trại</h1>
          <p className="mt-1 text-sm text-warmGray">
            Quản lý farm, nhà yến và zone của bạn
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Tạo Farm</Button>
      </div>

      {isLoading && <LoadingSkeleton count={2} className="h-28 w-full" />}

      {!isLoading && farms?.length === 0 && (
        <EmptyState
          title="Chưa có trang trại nào"
          description="Tạo farm đầu tiên để bắt đầu quản lý nhà yến, zone và thiết bị."
          action={
            <Button onClick={() => setShowCreate(true)}>+ Tạo Farm</Button>
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
              className="flex w-full items-center justify-between text-left"
              onClick={() =>
                setSelectedFarmId((id) => (id === farm._id ? null : farm._id))
              }
            >
              <div>
                <p className="font-bold">{farm.name}</p>
                <p className="text-sm text-warmGray">{farm.address}</p>
              </div>
              <span className="text-sm font-medium">
                {selectedFarmId === farm._id ? "Thu gọn" : "Quản lý"}
              </span>
            </button>
            {selectedFarmId === farm._id && (
              <HouseZoneManager farmId={farm._id} />
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
