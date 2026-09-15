import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  useHouses,
  useCreateHouse,
  useZones,
  useCreateZone,
} from "@/hooks/useFarms";
import { useZoneStore } from "@/store/zoneStore";
import { Button, Input, Modal, Card } from "@/components/ui";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import EmptyState from "@/components/common/EmptyState";

/** HouseZoneManager – quản lý House/Zone của 1 Farm (FARM-FR-002) */
export default function HouseZoneManager({ farmId }: { farmId: string }) {
  const { data: houses, isLoading } = useHouses(farmId);
  const createHouse = useCreateHouse(farmId);
  const [showCreateHouse, setShowCreateHouse] = useState(false);
  const [houseName, setHouseName] = useState("");

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

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-warmGray">
          Nhà yến (House)
        </h3>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowCreateHouse(true)}
        >
          + Thêm nhà
        </Button>
      </div>

      {isLoading && <LoadingSkeleton count={2} className="h-16 w-full" />}
      {!isLoading && houses?.length === 0 && (
        <EmptyState
          title="Chưa có nhà yến nào"
          description="Thêm nhà yến đầu tiên để bắt đầu tạo Zone và gắn thiết bị."
        />
      )}

      {houses?.map((house) => (
        <HouseRow key={house._id} houseId={house._id} name={house.name} />
      ))}

      <Modal
        open={showCreateHouse}
        onClose={() => setShowCreateHouse(false)}
        title="Thêm nhà yến"
      >
        <form onSubmit={handleCreateHouse} className="flex flex-col gap-4">
          <Input
            label="Tên nhà"
            required
            value={houseName}
            onChange={(e) => setHouseName(e.target.value)}
            placeholder="VD: Nhà chính"
          />
          <Button
            type="submit"
            loading={createHouse.isPending}
            className="w-full"
          >
            Tạo
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function HouseRow({ houseId, name }: { houseId: string; name: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card>
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="font-semibold text-charcoal">{name}</span>
        <span className="text-sm text-warmGray">
          {expanded ? "Thu gọn" : "Xem Zone"}
        </span>
      </button>
      {expanded && <ZoneManager houseId={houseId} />}
    </Card>
  );
}

function ZoneManager({ houseId }: { houseId: string }) {
  const { data: zones, isLoading } = useZones(houseId);
  const createZone = useCreateZone(houseId);
  const setZone = useZoneStore((s) => s.setZone);
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [zoneName, setZoneName] = useState("");

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
    setZone(zoneId, zoneName);
    navigate(path);
  }

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-warmGray/15 pt-4">
      <div className="flex items-center justify-between">
        <span className="label-caption">Zone</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowCreate(true)}
        >
          + Thêm zone
        </Button>
      </div>

      {isLoading && <LoadingSkeleton className="h-10 w-full" />}
      {!isLoading && zones?.length === 0 && (
        <p className="text-sm text-warmGray">Chưa có zone nào.</p>
      )}

      {zones?.map((zone) => (
        <div
          key={zone._id}
          className="flex items-center justify-between rounded-xl bg-warmGray/5 px-4 py-2.5"
        >
          <span className="text-sm font-medium text-charcoal">{zone.name}</span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goTo(zone._id, zone.name, "/dashboard")}
            >
              Dashboard
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goTo(zone._id, zone.name, "/devices")}
            >
              Thiết bị
            </Button>
          </div>
        </div>
      ))}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Thêm Zone"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input
            label="Tên zone"
            required
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            placeholder="VD: Tầng 1"
          />
          <Button
            type="submit"
            loading={createZone.isPending}
            className="w-full"
          >
            Tạo
          </Button>
        </form>
      </Modal>
    </div>
  );
}
