import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useZoneStore } from "@/store/zoneStore";
import { useAuthStore } from "@/store/authStore";
import { useSensorNodes } from "@/hooks/useDevices";
import { deviceApi } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Modal, Card, Badge } from "@/components/ui";
import { IconDevice } from "@/components/ui/icons";
import StatusDot from "@/components/common/StatusDot";
import RelayToggle from "@/components/common/RelayToggle";
import EmptyState from "@/components/common/EmptyState";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import { useToastStore } from "@/store/toastStore";

const RELAY_LABELS = {
  misting: "Phun sương",
  speaker: "Loa ru",
  ventilation: "Quạt thông gió",
  heating: "Sưởi",
} as const;

/** Devices Page – FARM-FR-003/005/006, ENV-FR-016..018 */
export default function DevicesPage() {
  const { selectedZoneId, selectedZoneName } = useZoneStore();
  const role = useAuthStore((s) => s.user?.role);
  // Đăng ký/kích hoạt thiết bị là việc của Technician (SRS §4.1, FARM-FR-003) —
  // Farm Owner chỉ xem và điều khiển relay, muốn lắp thêm thì tạo ticket lắp đặt.
  const canOnboard = role === "TECHNICIAN" || role === "ADMIN";
  const { data: nodes, isLoading } = useSensorNodes(
    selectedZoneId ?? undefined,
  );
  const queryClient = useQueryClient();
  const push = useToastStore((s) => s.push);

  const [showRegister, setShowRegister] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [registering, setRegistering] = useState(false);

  if (!selectedZoneId) {
    return (
      <EmptyState
        title="Chưa chọn Zone nào"
        description="Vào trang Trang trại, chọn 1 zone rồi bấm “Thiết bị” để quản lý ESP32 của zone đó."
        action={
          <Link to="/farms">
            <Button>Đi tới Trang trại</Button>
          </Link>
        }
      />
    );
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setRegistering(true);
    try {
      await deviceApi.registerSensorNode({
        device_id: deviceId,
        zone_id: selectedZoneId!,
      });
      await queryClient.invalidateQueries({ queryKey: ["sensor-nodes"] });
      push(`Đã kích hoạt thiết bị "${deviceId}" — chờ thiết bị kết nối`);
      setShowRegister(false);
      setDeviceId("");
    } catch (err) {
      const message = (
        err as { response?: { data?: { error?: { message?: string } } } }
      )?.response?.data?.error?.message;
      push(message ?? "Kích hoạt thiết bị thất bại", "error");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caption">Khu vực đang xem</p>
          <p className="truncate text-2xl font-bold tracking-tight text-charcoal">
            {selectedZoneName}
          </p>
        </div>
        {canOnboard && (
          <Button onClick={() => setShowRegister(true)}>
            + Kích hoạt thiết bị
          </Button>
        )}
      </div>

      {isLoading && <LoadingSkeleton count={2} className="h-40 w-full" />}

      {!isLoading && nodes?.length === 0 && (
        <EmptyState
          title="Zone này chưa có thiết bị"
          description={
            canOnboard
              ? "Kích hoạt ESP32 vào zone này: nhập device_id in trên vỏ máy, sau đó cấu hình WiFi cho thiết bị qua AP-mode."
              : "Thiết bị do kỹ thuật viên SwiftletCare lắp đặt và kích hoạt. Tạo yêu cầu lắp đặt để được hỗ trợ."
          }
          action={
            canOnboard ? (
              <Button onClick={() => setShowRegister(true)}>
                + Kích hoạt thiết bị
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {nodes?.map((node) => (
          <Card key={node._id} className="transition-shadow hover:shadow-dock">
            <div className="flex items-start justify-between gap-3 pb-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warmGray/10 text-charcoal">
                  <IconDevice />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold text-charcoal">
                    {node.device_id}
                  </p>
                  <p className="truncate text-xs text-warmGray">
                    Firmware {node.firmware_version} · RSSI{" "}
                    {node.rssi ?? "--"} dBm
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <StatusDot status={node.status} />
                <Badge tone={node.control_mode === "MANUAL" ? "warning" : "neutral"}>
                  {node.control_mode === "MANUAL" ? "Thủ công" : "Tự động"}
                </Badge>
              </div>
            </div>

            {node.status === "PENDING" ? (
              <p className="rounded-xl bg-insightPeach/25 px-3 py-2.5 text-xs font-medium text-charcoal">
                Thiết bị đã khai báo nhưng chưa kết nối lần nào — cấp nguồn và cấu
                hình WiFi để hoàn tất. Điều khiển relay sẽ bật khi thiết bị online.
              </p>
            ) : (
              <div className="divide-y divide-warmGray/10 border-t border-warmGray/10">
                {(
                  Object.keys(RELAY_LABELS) as Array<keyof typeof RELAY_LABELS>
                ).map((relayName) => (
                  <RelayToggle
                    key={relayName}
                    nodeId={node._id}
                    relayName={relayName}
                    label={RELAY_LABELS[relayName]}
                    checked={node.relay_states[relayName]}
                    mode={node.control_mode}
                  />
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      <Modal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        title="Kích hoạt thiết bị"
      >
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <Input
            label="Device ID"
            required
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="VD: node_001 (in trên vỏ ESP32)"
          />
          <p className="text-xs text-warmGray">
            Sau khi kích hoạt, thiết bị ở trạng thái “Chờ kết nối” cho tới khi gửi
            heartbeat đầu tiên. Cấp nguồn ESP32 và cấu hình WiFi của farm cho thiết
            bị để hoàn tất.
          </p>
          <Button type="submit" loading={registering} className="w-full">
            Kích hoạt
          </Button>
        </form>
      </Modal>
    </div>
  );
}
