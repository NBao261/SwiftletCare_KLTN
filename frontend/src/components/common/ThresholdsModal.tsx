import { useState, useEffect, FormEvent } from "react";
import { useZone, useUpdateThresholds, useResetThresholds } from "@/hooks/useFarms";
import { useToastStore } from "@/store/toastStore";
import { getApiErrorMessage } from "@/utils/helpers";
import { Button, Input, Modal } from "@/components/ui";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import ConfirmModal from "@/components/common/ConfirmModal";
import type { Zone } from "@/types";

/** ENV-FR-006/ENV-FR-020 — sửa/reset 7 ngưỡng tự động của 1 Zone (chỉ Farm Owner, gate ở nơi gọi) */
export default function ThresholdsModal({
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

  // Modal cha dựng lại mỗi lần mở (null→giá trị) nên component này mount mới
  // mỗi lần — vẫn seed qua effect (không phải useState(() => ...)) để đợi
  // useZone() fetch xong rồi mới đổ vào form, theo đúng quy ước 7.2
  // (FE_Design_Swiftlet.md) cho modal seed dữ liệu async.
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
