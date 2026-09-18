import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  useHouses,
  useCreateHouse,
  useZones,
  useCreateZone,
  useZone,
  useUpdateThresholds,
  useResetThresholds,
} from "@/hooks/useFarms";
import { useZoneStore } from "@/store/zoneStore";
import { usePermission } from "@/hooks/usePermission";
import { useToastStore } from "@/store/toastStore";
import { getApiErrorMessage } from "@/utils/helpers";
import { Button, Input, Modal, Card } from "@/components/ui";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import EmptyState from "@/components/common/EmptyState";
import ConfirmModal from "@/components/common/ConfirmModal";
import type { Zone } from "@/types";

/** HouseZoneManager – quản lý House/Zone của 1 Farm (FARM-FR-002) */
export default function HouseZoneManager({
  farmId,
  farmName,
}: {
  farmId: string;
  farmName: string;
}) {
  const { data: houses, isLoading } = useHouses(farmId);
  const createHouse = useCreateHouse(farmId);
  // Backend: POST /farms/:id/houses chỉ cho FARM_OWNER, TECHNICIAN, ADMIN
  const canManage = usePermission("FARM_OWNER", "TECHNICIAN", "ADMIN");
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
        {canManage && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCreateHouse(true)}
          >
            + Thêm nhà
          </Button>
        )}
      </div>

      {isLoading && <LoadingSkeleton count={2} className="h-16 w-full" />}
      {!isLoading && houses?.length === 0 && (
        <EmptyState
          title="Chưa có nhà yến nào"
          description="Thêm nhà yến đầu tiên để bắt đầu tạo Zone và gắn thiết bị."
        />
      )}

      {houses?.map((house) => (
        <HouseRow
          key={house._id}
          farmId={farmId}
          farmName={farmName}
          houseId={house._id}
          name={house.name}
        />
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

function HouseRow({
  farmId,
  farmName,
  houseId,
  name,
}: {
  farmId: string;
  farmName: string;
  houseId: string;
  name: string;
}) {
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
      {expanded && (
        <ZoneManager farmId={farmId} farmName={farmName} houseId={houseId} />
      )}
    </Card>
  );
}

function ZoneManager({
  farmId,
  farmName,
  houseId,
}: {
  farmId: string;
  farmName: string;
  houseId: string;
}) {
  const { data: zones, isLoading } = useZones(houseId);
  const createZone = useCreateZone(houseId);
  // Backend: POST /farms/houses/:houseId/zones chỉ cho FARM_OWNER, TECHNICIAN, ADMIN
  const canManage = usePermission("FARM_OWNER", "TECHNICIAN", "ADMIN");
  // Route /dashboard chỉ cho FARM_OWNER (RequireRole trong App.tsx), và chỉnh
  // ngưỡng tự động (ENV-FR-006) cũng chỉ Farm Owner theo RACI — Technician/Admin
  // chỉ xem Zone, không sửa/xem Dashboard môi trường chi tiết.
  const isFarmOwner = usePermission("FARM_OWNER");
  const setZone = useZoneStore((s) => s.setZone);
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [thresholdsZone, setThresholdsZone] = useState<{
    id: string;
    name: string;
  } | null>(null);

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
    setZone(farmId, farmName, zoneId, zoneName);
    navigate(path);
  }

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-warmGray/15 pt-4">
      <div className="flex items-center justify-between">
        <span className="label-caption">Zone</span>
        {canManage && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCreate(true)}
          >
            + Thêm zone
          </Button>
        )}
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
            {isFarmOwner && (
              <>
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
                  onClick={() =>
                    setThresholdsZone({ id: zone._id, name: zone.name })
                  }
                >
                  Ngưỡng
                </Button>
              </>
            )}
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

      {thresholdsZone && (
        <ThresholdsModal
          zoneId={thresholdsZone.id}
          zoneName={thresholdsZone.name}
          onClose={() => setThresholdsZone(null)}
        />
      )}
    </div>
  );
}

/** ENV-FR-006/ENV-FR-020 — sửa/reset 7 ngưỡng tự động của 1 Zone (chỉ Farm Owner, xem ZoneManager) */
function ThresholdsModal({
  zoneId,
  zoneName,
  onClose,
}: {
  zoneId: string;
  zoneName: string;
  onClose: () => void;
}) {
  const { data: zone, isLoading } = useZone(zoneId);
  const updateThresholds = useUpdateThresholds(zoneId);
  const resetThresholds = useResetThresholds(zoneId);
  const push = useToastStore((s) => s.push);
  const [form, setForm] = useState<Zone["thresholds"] | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Modal cha dựng lại mỗi lần mở (thresholdsZone chuyển null→giá trị) nên
  // component này mount mới mỗi lần — vẫn seed qua effect (không phải
  // useState(() => ...)) để đợi useZone() fetch xong rồi mới đổ vào form,
  // theo đúng quy ước 7.2 (FE_Design_Swiftlet.md) cho modal seed dữ liệu async.
  useEffect(() => {
    if (zone) setForm(zone.thresholds);
  }, [zone]);

  function setField(key: keyof Zone["thresholds"], raw: string) {
    const value = Number(raw);
    setForm((f) => (f ? { ...f, [key]: Number.isNaN(value) ? f[key] : value } : f));
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    updateThresholds.mutate(form, {
      onSuccess: () => {
        push("Đã lưu ngưỡng mới");
        onClose();
      },
      onError: (err) => push(getApiErrorMessage(err, "Lưu ngưỡng thất bại"), "error"),
    });
  }

  function handleReset() {
    resetThresholds.mutate(undefined, {
      onSuccess: () => {
        push("Đã reset về mặc định");
        setShowResetConfirm(false);
        onClose();
      },
      onError: (err) => {
        push(getApiErrorMessage(err, "Reset thất bại"), "error");
        setShowResetConfirm(false);
      },
    });
  }

  return (
    <>
      <Modal
        open={!showResetConfirm}
        onClose={onClose}
        title={`Ngưỡng tự động — ${zoneName}`}
      >
        {isLoading || !form ? (
          <LoadingSkeleton className="h-64 w-full" />
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Nhiệt độ min (°C)"
                type="number"
                step="0.1"
                value={form.temp_min}
                onChange={(e) => setField("temp_min", e.target.value)}
              />
              <Input
                label="Nhiệt độ max (°C)"
                type="number"
                step="0.1"
                value={form.temp_max}
                onChange={(e) => setField("temp_max", e.target.value)}
              />
              <Input
                label="Độ ẩm min (%)"
                type="number"
                step="0.1"
                value={form.humidity_min}
                onChange={(e) => setField("humidity_min", e.target.value)}
              />
              <Input
                label="Độ ẩm max (%)"
                type="number"
                step="0.1"
                value={form.humidity_max}
                onChange={(e) => setField("humidity_max", e.target.value)}
              />
              <Input
                label="Ánh sáng max (lux)"
                type="number"
                step="0.01"
                value={form.light_max}
                onChange={(e) => setField("light_max", e.target.value)}
              />
              <Input
                label="NH3 max (ppm)"
                type="number"
                value={form.nh3_max}
                onChange={(e) => setField("nh3_max", e.target.value)}
              />
              <Input
                label="CO2 max (ppm)"
                type="number"
                value={form.co2_max}
                onChange={(e) => setField("co2_max", e.target.value)}
              />
            </div>
            <p className="text-xs text-warmGray">
              Quyết định lúc nào quạt/phun sương/sưởi tự động bật (ENV-FR-006)
              — áp dụng ngay cho thiết bị đang online trong zone này.
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setShowResetConfirm(true)}
              >
                Reset về mặc định
              </Button>
              <Button
                type="submit"
                loading={updateThresholds.isPending}
                className="flex-1"
              >
                Lưu
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={showResetConfirm}
        title="Reset ngưỡng về mặc định?"
        description="Ghi đè cả 7 giá trị hiện tại về mặc định kỹ thuật (26-31°C, 75-95% độ ẩm, NH3<25ppm, CO2<1500ppm...). Không thể hoàn tác."
        confirmLabel="Reset"
        danger
        loading={resetThresholds.isPending}
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </>
  );
}
