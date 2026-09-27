import { useState, FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFarm, useHouses, useZones, useCreateZone } from "@/hooks/shared/useFarms";
import { useZoneStore } from "@/stores/zoneStore";
import { usePageBreadcrumb, usePageBack } from "@/hooks/common/useBreadcrumb";
import { Button, Input, Modal, Select } from "@/components/ui";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { validateRoomName } from "@/validations/admin/house.validation";
import { getApiErrorMessage } from "@/lib/helpers";

/**
 * Phòng (= Zone ở backend) của 1 nhà yến cho Admin (/system/farms/:farmId/houses/:houseId) —
 * FARM-FR-002/009, nhóm theo tầng (1..house.floors) để thấy ngay tầng nào chưa có phòng,
 * tức chưa được giám sát. Không có nút Dashboard: route /dashboard chỉ cho Farm Owner.
 */
export default function AdminFarmHousePage() {
  const { farmId, houseId } = useParams<{ farmId: string; houseId: string }>();
  const navigate = useNavigate();
  const { data: farm } = useFarm(farmId);
  // Không có API lấy 1 house theo id — tra trong danh sách house của farm (đã fetch sẵn ở trang cha, cache lại nhờ react-query)
  const { data: houses } = useHouses(farmId);
  const house = houses?.find((h) => h._id === houseId);
  const { data: rooms, isLoading } = useZones(houseId);
  const createRoom = useCreateZone(houseId!);
  const setZone = useZoneStore((s) => s.setZone);
  // null = modal đóng; số = modal mở, chọn sẵn tầng đó
  const [createFloor, setCreateFloor] = useState<number | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomNameError, setRoomNameError] = useState<string>();

  usePageBreadcrumb(
    farm && house
      ? [{ label: farm.name, onClick: () => navigate(`/system/farms/${farmId}`) }, { label: house.name }]
      : [],
  );
  usePageBack(`/system/farms/${farmId}`, farm?.name ?? "trang trại");

  function closeCreate() {
    setCreateFloor(null);
    setRoomName("");
    setRoomNameError(undefined);
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const error = validateRoomName(roomName, rooms?.map((r) => r.name) ?? []);
    if (error) return setRoomNameError(error);
    createRoom.mutate(
      { name: roomName.trim(), floor: createFloor ?? 1 },
      {
        onSuccess: closeCreate,
        onError: (err) => setRoomNameError(getApiErrorMessage(err, "Tạo phòng thất bại — thử lại.")),
      },
    );
  }

  function openDevices(roomId: string, name: string) {
    setZone(farmId!, farm?.name ?? "", roomId, name);
    navigate("/devices");
  }

  if (!house) return <LoadingSkeleton className="h-28 w-full" />;

  // Phòng cũ có thể nằm ở tầng > house.floors (dữ liệu seed) — mở rộng để không phòng nào bị ẩn
  const floorCount = Math.max(house.floors, ...(rooms ?? []).map((r) => r.floor));
  const floors = Array.from({ length: floorCount }, (_, i) => i + 1);
  const emptyFloors = floors.filter((f) => !rooms?.some((r) => r.floor === f)).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="truncate text-2xl font-bold tracking-tight text-charcoal">{house.name}</p>
          <p className="text-sm text-warmGray">
            {house.floors} tầng · {rooms?.length ?? 0} phòng
            {!isLoading && emptyFloors > 0 && (
              <span className="font-semibold text-orange-600"> · {emptyFloors} tầng chưa có phòng</span>
            )}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setCreateFloor(1)}>
          + Thêm phòng
        </Button>
      </div>

      {isLoading && <LoadingSkeleton count={2} className="h-16 w-full" />}

      {!isLoading &&
        floors.map((floor) => {
          const floorRooms = rooms?.filter((r) => r.floor === floor) ?? [];
          return (
            <section key={floor} className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-bold text-charcoal">Tầng {floor}</h3>
                <span className="text-xs text-warmGray">{floorRooms.length} phòng</span>
              </div>

              {floorRooms.length === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-warmGray/30 px-4 py-3">
                  <span className="text-sm text-warmGray">Chưa có phòng — tầng này chưa được giám sát.</span>
                  <Button variant="secondary" size="sm" onClick={() => setCreateFloor(floor)}>
                    + Thêm phòng tầng {floor}
                  </Button>
                </div>
              ) : (
                floorRooms.map((room) => (
                  <div key={room._id} className="flex items-center justify-between rounded-xl bg-warmGray/5 px-4 py-2.5">
                    <span className="text-sm font-medium text-charcoal">{room.name}</span>
                    <Button variant="secondary" size="sm" onClick={() => openDevices(room._id, room.name)}>
                      Thiết bị & Cảm biến
                    </Button>
                  </div>
                ))
              )}
            </section>
          );
        })}

      <Modal open={createFloor !== null} onClose={closeCreate} title="Thêm phòng">
        {/* noValidate: tắt tooltip native tiếng Anh — lỗi hiện dưới ô qua validateRoomName */}
        <form onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
          <Select label="Tầng" value={createFloor ?? 1} onChange={(e) => setCreateFloor(Number(e.target.value))}>
            {floors.map((f) => (
              <option key={f} value={f}>Tầng {f}</option>
            ))}
          </Select>
          <Input
            label="Tên phòng"
            required
            value={roomName}
            onChange={(e) => {
              setRoomName(e.target.value);
              setRoomNameError(undefined);
            }}
            error={roomNameError}
            aria-invalid={!!roomNameError}
            placeholder="VD: Phòng 1"
          />
          <Button type="submit" loading={createRoom.isPending} className="w-full">
            Tạo
          </Button>
        </form>
      </Modal>
    </div>
  );
}
