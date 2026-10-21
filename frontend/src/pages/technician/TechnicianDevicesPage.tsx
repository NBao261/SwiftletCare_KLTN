import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useZoneStore } from "@/stores/zoneStore";
import { usePermission } from "@/hooks/common/usePermission";
import { useSensorNodes, useSendNodeCommand } from "@/hooks/shared/useDevices";
import { deviceApi } from "@/apis/shared/devices.api";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Modal, Card } from "@/components/ui";
import ConfirmModal from "@/components/ui/ConfirmModal";
import EmptyState from "@/components/ui/EmptyState";
import SystemHealthBar, { needsAttention } from "@/components/features/technician/devices/SystemHealthBar";
import DeviceFilterToolbar, { type DeviceSortKey } from "@/components/features/technician/devices/DeviceFilterToolbar";
import type { SortDirection } from "@/types";
import DeviceListRow from "@/components/features/technician/devices/DeviceListRow";
import FarmHouseZonePicker, {
  FarmHouseZonePickerValue,
} from "@/components/features/technician/devices/FarmHouseZonePicker";
import ThresholdsModal from "@/components/features/technician/devices/ThresholdsModal";
import SpeakerScheduleModal from "@/components/features/technician/devices/SpeakerScheduleModal";
import AudioTracksModal from "@/components/features/technician/devices/AudioTracksModal";
import DecommissionDeviceModal from "@/components/features/technician/devices/DecommissionDeviceModal";
import ReplaceDeviceModal from "@/components/features/technician/devices/ReplaceDeviceModal";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useToastStore } from "@/stores/toastStore";
import { getApiErrorMessage } from "@/lib/helpers";

/** Devices Page – FARM-FR-003/005/006, ENV-FR-013b/013c, ENV-FR-016..018 */
export default function TechnicianDevicesPage() {
  const { selectedZoneId, selectedZoneName } = useZoneStore();
  // Đăng ký/kích hoạt thiết bị là việc của Technician (SRS §4.1, FARM-FR-003) —
  // Farm Owner chỉ xem và điều khiển relay, muốn lắp thêm thì tạo ticket lắp đặt.
  const canOnboard = usePermission("TECHNICIAN", "ADMIN");
  // Chỉnh ngưỡng tự động (ENV-FR-006): Farm Owner vận hành hằng ngày, Technician chỉnh khi
  // xử lý sự cố (RACI mục 4.4) — PUT /farms/zones/:zoneId/thresholds cho cả hai vai trò.
  const canEditThresholds = usePermission("FARM_OWNER", "TECHNICIAN");
  const { data: nodes, isLoading } = useSensorNodes(
    selectedZoneId ?? undefined,
  );
  const queryClient = useQueryClient();
  const push = useToastStore((s) => s.push);

  const [showRegister, setShowRegister] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [registering, setRegistering] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<DeviceSortKey>("last_heartbeat");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  // BE trả 501 khi firmware của thiết bị đó chưa hỗ trợ RESTART (trước 1.4.0) → khoá nút của riêng thiết bị đó
  const [rebootUnsupportedIds, setRebootUnsupportedIds] = useState<Set<string>>(new Set());
  // POST /devices/sensor-nodes/:id/commands chỉ cho TECHNICIAN/ADMIN (TICKET-FR-008)
  const sendCommand = useSendNodeCommand();
  const [rebootNodeId, setRebootNodeId] = useState<string | null>(null);

  const hasActiveFilters = !!searchQuery || statusFilter !== "ALL" || sortBy !== "last_heartbeat" || sortDir !== "desc";
  function clearFilters() {
    setSearchQuery(""); setStatusFilter("ALL"); setSortBy("last_heartbeat"); setSortDir("desc");
  }
  function handleSortChange(key: DeviceSortKey) {
    if (key === sortBy) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir(key === "device_id" ? "asc" : "desc"); }
  }

  const filteredNodes = nodes
    ?.filter(node => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q ||
        node.device_id.toLowerCase().includes(q) ||
        (node.firmware_version ?? "").toLowerCase().includes(q);

      let matchStatus = true;
      if (statusFilter !== "ALL") {
        matchStatus = statusFilter === "WARNING" ? needsAttention(node) : node.status === statusFilter;
      }
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "device_id") return a.device_id.localeCompare(b.device_id) * dir;
      if (sortBy === "rssi") return ((a.rssi ?? -999) - (b.rssi ?? -999)) * dir;
      const ta = a.last_heartbeat ? new Date(a.last_heartbeat).getTime() : 0;
      const tb = b.last_heartbeat ? new Date(b.last_heartbeat).getTime() : 0;
      return (ta - tb) * dir;
    });

  const [reassignNodeId, setReassignNodeId] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState<
    Partial<FarmHouseZonePickerValue>
  >({});
  const [reassigning, setReassigning] = useState(false);

  // Lưu id (không lưu object) để modal luôn đọc bản mới nhất của thiết bị từ query
  const [scheduleNodeId, setScheduleNodeId] = useState<string | null>(null);
  const [audioNodeId, setAudioNodeId] = useState<string | null>(null);
  const scheduleNode = nodes?.find((n) => n._id === scheduleNodeId);
  const audioNode = nodes?.find((n) => n._id === audioNodeId);
  // FARM-FR-008 — gỡ / thay thiết bị (BE: TECHNICIAN, ADMIN)
  const [decommissionNodeId, setDecommissionNodeId] = useState<string | null>(null);
  const [replaceNodeId, setReplaceNodeId] = useState<string | null>(null);
  const decommissionNode = nodes?.find((n) => n._id === decommissionNodeId) ?? null;
  const replaceNode = nodes?.find((n) => n._id === replaceNodeId) ?? null;
  const rebootNode = nodes?.find((n) => n._id === rebootNodeId) ?? null;

  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

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
        device_id: deviceId.trim(),
        zone_id: selectedZoneId!,
        secret_key: secretKey.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["sensor-nodes"] });
      push(
        `Đã kích hoạt thiết bị "${deviceId}" — cấp nguồn & cấu hình WiFi qua AP-mode, hệ thống sẽ tự nhận đúng Zone khi thiết bị online`,
      );
      setShowRegister(false);
      setDeviceId("");
      setSecretKey("");
    } catch (err) {
      push(getApiErrorMessage(err, "Kích hoạt thiết bị thất bại"), "error");
    } finally {
      setRegistering(false);
    }
  }

  async function handleReassign(e: FormEvent) {
    e.preventDefault();
    if (!reassignNodeId || !reassignTarget.zoneId) return;
    setReassigning(true);
    try {
      await deviceApi.reassignZone(reassignNodeId, reassignTarget.zoneId);
      await queryClient.invalidateQueries({ queryKey: ["sensor-nodes"] });
      push(
        "Đã gửi lệnh dời Zone — thiết bị sẽ khởi động lại và kết nối lại sau vài giây",
      );
      setReassignNodeId(null);
      setReassignTarget({});
    } catch (err) {
      push(getApiErrorMessage(err, "Dời Zone thất bại"), "error");
    } finally {
      setReassigning(false);
    }
  }

  function handleReboot() {
    if (!rebootNode) return;
    const deviceLabel = rebootNode.device_id;
    const nodeId = rebootNode._id;
    sendCommand.mutate(
      { nodeId: rebootNode._id, input: { command: "RESTART" } },
      {
        onSuccess: () => {
          push(`Đã gửi lệnh khởi động lại tới ${deviceLabel}`);
          setRebootNodeId(null);
        },
        onError: (err) => {
          if ((err as { response?: { status?: number } })?.response?.status === 501) {
            setRebootUnsupportedIds(prev => new Set(prev).add(nodeId));
            push("Firmware chưa hỗ trợ lệnh khởi động lại từ xa (501)", "error");
          } else {
            push(getApiErrorMessage(err, "Khởi động lại thất bại"), "error");
          }
          setRebootNodeId(null);
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {canEditThresholds && (
            <Button
              variant="secondary"
              onClick={() => setShowThresholds(true)}
            >
              Ngưỡng cảm biến
            </Button>
          )}
          {canOnboard && (
            <Button onClick={() => setShowRegister(true)}>
              + Kích hoạt thiết bị
            </Button>
          )}
        </div>
      </div>

      <Card size="lg" className="pb-10 flex flex-col gap-5">

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

        {!isLoading && (nodes?.length ?? 0) > 0 && (
          <div className="flex w-full flex-col gap-5 mb-4 animate-fade-in">
            <SystemHealthBar nodes={nodes} />
            <DeviceFilterToolbar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortChange={handleSortChange}
              hasActiveFilters={hasActiveFilters}
              onClear={clearFilters}
            />
          </div>
        )}

        <div className="flex flex-col pb-8">
          <div className="bg-white border border-warmGray/15 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            {filteredNodes?.map((node, i) => (
              <DeviceListRow
                key={node._id}
                index={i}
                node={node}
                zoneId={selectedZoneId!}
                isExpanded={expandedNodeId === node._id}
                onToggleExpand={() => setExpandedNodeId(prev => prev === node._id ? null : node._id)}
                onOpenSchedule={() => setScheduleNodeId(node._id)}
                onOpenAudio={() => setAudioNodeId(node._id)}
                onOpenReassign={() => setReassignNodeId(node._id)}
                onOpenReplace={() => setReplaceNodeId(node._id)}
                onOpenDecommission={() => setDecommissionNodeId(node._id)}
                canOnboard={canOnboard}
                rebootUnsupported={rebootUnsupportedIds.has(node._id)}
                onReboot={canOnboard ? () => setRebootNodeId(node._id) : undefined}
              />
            ))}
            {filteredNodes?.length === 0 && !isLoading && (nodes?.length ?? 0) > 0 && (
              <div className="text-center p-8 text-warmGray">
                Không tìm thấy thiết bị nào khớp với bộ lọc.
              </div>
            )}
          </div>
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
            <Input
              label="secretKey"
              required
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="VD: ABCD-EFGH-JKMN (in trên nhãn thiết bị)"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-warmGray">
              Sau khi kích hoạt, thiết bị ở trạng thái “Chờ kết nối” cho tới khi
              gửi heartbeat đầu tiên. Cấp nguồn ESP32 và cấu hình WiFi của farm
              cho thiết bị qua AP-mode để hoàn tất — hệ thống tự nhận đúng Zone,
              không cần thao tác gì thêm.
            </p>
            <Button
              type="submit"
              loading={registering}
              disabled={!deviceId.trim() || !secretKey.trim()}
              className="w-full"
            >
              Kích hoạt
            </Button>
          </form>
        </Modal>

        <Modal
          open={reassignNodeId !== null}
          onClose={() => {
            setReassignNodeId(null);
            setReassignTarget({});
          }}
          title="Dời thiết bị sang Zone khác"
        >
          <form onSubmit={handleReassign} className="flex flex-col gap-4">
            <FarmHouseZonePicker
              value={reassignTarget}
              onChange={setReassignTarget}
            />
            <p className="text-xs text-warmGray">
              Thiết bị sẽ khởi động lại và kết nối lại theo Zone mới (~5-10
              giây). Chỉ thực hiện được khi thiết bị đang online.
            </p>
            <Button
              type="submit"
              loading={reassigning}
              disabled={!reassignTarget.zoneId}
              className="w-full"
            >
              Xác nhận dời Zone
            </Button>
          </form>
        </Modal>

        {scheduleNode && (
          <SpeakerScheduleModal
            node={scheduleNode}
            onClose={() => setScheduleNodeId(null)}
          />
        )}

        {audioNode && (
          <AudioTracksModal
            node={audioNode}
            onClose={() => setAudioNodeId(null)}
          />
        )}

        <ReplaceDeviceModal
          node={replaceNode}
          onClose={() => setReplaceNodeId(null)}
        />
        <DecommissionDeviceModal
          node={decommissionNode}
          onClose={() => setDecommissionNodeId(null)}
        />

        <ConfirmModal
          open={rebootNode !== null}
          title="Khởi động lại thiết bị?"
          description={rebootNode ? `Thiết bị ${rebootNode.device_id} sẽ mất kết nối trong vài giây rồi tự kết nối lại. Rơ-le đang chạy có thể bị ngắt tạm thời.` : undefined}
          confirmLabel="Khởi động lại"
          danger
          loading={sendCommand.isPending}
          onConfirm={handleReboot}
          onCancel={() => setRebootNodeId(null)}
        />

        {showThresholds && (
          <ThresholdsModal
            zoneId={selectedZoneId}
            zoneName={selectedZoneName ?? ""}
            onClose={() => setShowThresholds(false)}
          />
        )}

      </Card>
    </div>
  );
}
