import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useZoneStore } from "@/store/zoneStore";
import { useSensorNodes } from "@/hooks/useDevices";
import { deviceApi } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Modal, Card } from "@/components/ui";
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
      push(`Đã đăng ký thiết bị "${deviceId}"`);
      setShowRegister(false);
      setDeviceId("");
    } catch (err) {
      const message = (
        err as { response?: { data?: { error?: { message?: string } } } }
      )?.response?.data?.error?.message;
      push(message ?? "Đăng ký thiết bị thất bại", "error");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">
            Thiết bị — {selectedZoneName}
          </h1>
          <p className="mt-1 text-sm text-warmGray">
            Danh sách ESP32 và điều khiển relay
          </p>
        </div>
        <Button onClick={() => setShowRegister(true)}>
          + Đăng ký thiết bị
        </Button>
      </div>

      {isLoading && <LoadingSkeleton count={2} className="h-40 w-full" />}

      {!isLoading && nodes?.length === 0 && (
        <EmptyState
          title="Zone này chưa có thiết bị"
          description="Đăng ký ESP32 (device_id khớp Config::deviceId trong firmware) vào zone này."
          action={
            <Button onClick={() => setShowRegister(true)}>
              + Đăng ký thiết bị
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {nodes?.map((node) => (
          <Card key={node._id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-charcoal">{node.device_id}</p>
                <p className="text-xs text-warmGray">
                  Firmware {node.firmware_version} · RSSI {node.rssi ?? "--"}{" "}
                  dBm
                </p>
              </div>
              <StatusDot status={node.status} />
            </div>
            <div className="mt-2 divide-y divide-warmGray/10">
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
          </Card>
        ))}
      </div>

      <Modal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        title="Đăng ký thiết bị"
      >
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <Input
            label="Device ID"
            required
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="VD: node_001 (khớp Config::deviceId firmware)"
          />
          <Button type="submit" loading={registering} className="w-full">
            Đăng ký
          </Button>
        </form>
      </Modal>
    </div>
  );
}
