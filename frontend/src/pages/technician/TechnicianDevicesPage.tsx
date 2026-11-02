import { useState, useMemo, useEffect, FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { usePermission } from "@/hooks/common/usePermission";
import { useSensorNodes, useSendNodeCommand } from "@/hooks/shared/useDevices";
import { useFarms, useHouses, useZones, useAllZones } from "@/hooks/shared/useFarms";
import { deviceApi } from "@/apis/shared/devices.api";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Input, Modal, Card, SelectMenu } from "@/components/ui";
import { IconFarm } from "@/components/ui/icons";
import ConfirmModal from "@/components/ui/ConfirmModal";
import EmptyState from "@/components/ui/EmptyState";
import SystemHealthBar, { needsAttention } from "@/components/features/technician/devices/SystemHealthBar";
import DeviceFilterToolbar, { type DeviceSortKey } from "@/components/features/technician/devices/DeviceFilterToolbar";
import type { SortDirection } from "@/types";
import DeviceListRow from "@/components/features/technician/devices/DeviceListRow";
import FarmHouseZonePicker, {
  FarmHouseZonePickerValue,
} from "@/components/features/technician/devices/FarmHouseZonePicker";
import AudioTracksModal from "@/components/features/technician/devices/AudioTracksModal";
import DecommissionDeviceModal from "@/components/features/technician/devices/DecommissionDeviceModal";
import ReplaceDeviceModal from "@/components/features/technician/devices/ReplaceDeviceModal";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useToastStore } from "@/stores/toastStore";
import { getApiErrorMessage } from "@/lib/helpers";

/** Devices Page – FARM-FR-003/005/006, ENV-FR-013b/013c, ENV-FR-016..018 */
export default function TechnicianDevicesPage() {
  const canOnboard = usePermission("TECHNICIAN");
  const [searchParams, setSearchParams] = useSearchParams();

  // Bộ lọc vị trí độc lập (Local state) — khởi tạo từ searchParams nếu có điều hướng từ trang Trang trại
  const [filterFarmId, setFilterFarmId] = useState<string>(searchParams.get("farmId") || "");
  const [filterHouseId, setFilterHouseId] = useState<string>(searchParams.get("houseId") || "");
  const [filterZoneId, setFilterZoneId] = useState<string>(searchParams.get("zoneId") || "");

  useEffect(() => {
    const fId = searchParams.get("farmId") || "";
    const hId = searchParams.get("houseId") || "";
    const zId = searchParams.get("zoneId") || "";
    if (fId) setFilterFarmId(fId);
    if (hId) setFilterHouseId(hId);
    if (zId) setFilterZoneId(zId);
  }, [searchParams]);

  const { data: farms, isLoading: loadingFarms } = useFarms();
  const { data: houses, isLoading: loadingHouses } = useHouses(filterFarmId || undefined);
  const { data: zones, isLoading: loadingZones } = useZones(filterHouseId || undefined);
  const { data: allZones } = useAllZones();

  // Tra cứu vị trí (Farm -> Nhà -> Zone) cho từng node
  const zoneLocationMap = useMemo(() => {
    const map = new Map<string, { zoneName: string; houseName: string; farmName: string; farmId: string; houseId: string }>();
    allZones?.forEach(z => {
      map.set(z._id, { zoneName: z.name, houseName: z.houseName, farmName: z.farmName, farmId: z.farmId, houseId: z.house_id });
    });
    return map;
  }, [allZones]);

  // Nếu chọn zone cụ thể, BE filter theo zone; nếu không, lấy toàn bộ thiết bị mà technician có quyền
  const { data: nodes, isLoading } = useSensorNodes(filterZoneId || undefined);

  // Lọc theo Farm/House khi chưa chọn tới Zone
  const scopedNodes = useMemo(() => {
    if (!nodes) return [];
    if (filterZoneId) return nodes;
    if (filterHouseId) {
      return nodes.filter(n => zoneLocationMap.get(n.zone_id)?.houseId === filterHouseId);
    }
    if (filterFarmId) {
      return nodes.filter(n => zoneLocationMap.get(n.zone_id)?.farmId === filterFarmId);
    }
    return nodes;
  }, [nodes, filterZoneId, filterHouseId, filterFarmId, zoneLocationMap]);

  const queryClient = useQueryClient();
  const push = useToastStore((s) => s.push);

  const [showRegister, setShowRegister] = useState(false);
  const [registerTarget, setRegisterTarget] = useState<Partial<FarmHouseZonePickerValue>>({});
  const [deviceId, setDeviceId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [registering, setRegistering] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<DeviceSortKey>("last_heartbeat");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [rebootUnsupportedIds, setRebootUnsupportedIds] = useState<Set<string>>(new Set());
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

  const filteredNodes = scopedNodes
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

  const [audioNodeId, setAudioNodeId] = useState<string | null>(null);
  const audioNode = nodes?.find((n) => n._id === audioNodeId);
  const [decommissionNodeId, setDecommissionNodeId] = useState<string | null>(null);
  const [replaceNodeId, setReplaceNodeId] = useState<string | null>(null);
  const decommissionNode = nodes?.find((n) => n._id === decommissionNodeId) ?? null;
  const replaceNode = nodes?.find((n) => n._id === replaceNodeId) ?? null;
  const rebootNode = nodes?.find((n) => n._id === rebootNodeId) ?? null;

  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  function handleOpenRegister() {
    setRegisterTarget({
      farmId: filterFarmId || undefined,
      houseId: filterHouseId || undefined,
      zoneId: filterZoneId || undefined,
    });
    setShowRegister(true);
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (!registerTarget.zoneId) {
      push("Vui lòng chọn Zone để gán thiết bị", "error");
      return;
    }
    setRegistering(true);
    try {
      await deviceApi.registerSensorNode({
        device_id: deviceId.trim(),
        zone_id: registerTarget.zoneId,
        secret_key: secretKey.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["sensor-nodes"] });
      push(
        `Đã kích hoạt thiết bị "${deviceId}" — cấp nguồn & cấu hình WiFi qua AP-mode, hệ thống sẽ tự nhận đúng Zone khi thiết bị online`,
      );
      setShowRegister(false);
      setDeviceId("");
      setSecretKey("");
      setRegisterTarget({});
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

  const hasLocationFilter = Boolean(filterFarmId || filterHouseId || filterZoneId);

  return (
    <div className="flex flex-col gap-6">
      {/* Thanh bộ lọc Vị trí (Farm - Nhà - Zone) + Nút thao tác */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-warmGray/15 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-charcoal shrink-0 mr-1">
            <IconFarm width={18} height={18} className="text-warmGray" />
            <span>Vị trí:</span>
          </div>

          <div className="w-full sm:w-48">
            <SelectMenu
              field
              disabled={loadingFarms}
              ariaLabel="Lọc theo trang trại"
              value={filterFarmId}
              options={[
                { value: '', label: 'Tất cả trang trại' },
                ...(farms?.map(f => ({ value: f._id, label: f.name })) ?? [])
              ]}
              onChange={val => {
                setFilterFarmId(val);
                setFilterHouseId('');
                setFilterZoneId('');
              }}
            />
          </div>

          <div className="w-full sm:w-44">
            <SelectMenu
              field
              disabled={!filterFarmId || loadingHouses}
              ariaLabel="Lọc theo nhà"
              value={filterHouseId}
              options={[
                { value: '', label: filterFarmId ? 'Tất cả nhà' : 'Tất cả nhà' },
                ...(houses?.map(h => ({ value: h._id, label: h.name })) ?? [])
              ]}
              onChange={val => {
                setFilterHouseId(val);
                setFilterZoneId('');
              }}
            />
          </div>

          <div className="w-full sm:w-44">
            <SelectMenu
              field
              disabled={!filterHouseId || loadingZones}
              ariaLabel="Lọc theo zone"
              value={filterZoneId}
              options={[
                { value: '', label: filterHouseId ? 'Tất cả zone' : 'Tất cả zone' },
                ...(zones?.map(z => ({ value: z._id, label: z.name })) ?? [])
              ]}
              onChange={val => setFilterZoneId(val)}
            />
          </div>

          {hasLocationFilter && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFilterFarmId('');
                setFilterHouseId('');
                setFilterZoneId('');
                setSearchParams({});
              }}
              className="text-xs"
            >
              Xoá lọc vị trí
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
          {canOnboard && (
            <Button onClick={handleOpenRegister}>
              + Kích hoạt thiết bị
            </Button>
          )}
        </div>
      </div>

      <Card size="lg" className="pb-10 flex flex-col gap-5">
        {isLoading && <LoadingSkeleton count={2} className="h-40 w-full" />}

        {!isLoading && scopedNodes.length === 0 && (
          <EmptyState
            title={hasLocationFilter ? "Khu vực này chưa có thiết bị" : "Chưa có thiết bị nào"}
            description={
              hasLocationFilter
                ? "Không tìm thấy thiết bị ESP32 nào được lắp đặt tại khu vực đang lọc. Bạn có thể kích hoạt thiết bị mới vào vị trí này."
                : "Hệ thống chưa có thiết bị ESP32 nào được kích hoạt. Hãy bấm “+ Kích hoạt thiết bị” để bắt đầu."
            }
            action={
              canOnboard ? (
                <Button onClick={handleOpenRegister}>
                  + Kích hoạt thiết bị
                </Button>
              ) : undefined
            }
          />
        )}

        {!isLoading && scopedNodes.length > 0 && (
          <div className="flex w-full flex-col gap-5 mb-4 animate-fade-in">
            <SystemHealthBar nodes={scopedNodes} />
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
            {filteredNodes?.map((node, i) => {
              const loc = zoneLocationMap.get(node.zone_id);
              const locationLabel = loc ? `${loc.farmName} · ${loc.houseName} · ${loc.zoneName}` : undefined;

              return (
                <DeviceListRow
                  key={node._id}
                  index={i}
                  node={node}
                  zoneId={node.zone_id}
                  locationLabel={locationLabel}
                  isExpanded={expandedNodeId === node._id}
                  onToggleExpand={() => setExpandedNodeId(prev => prev === node._id ? null : node._id)}
                  onOpenAudio={() => setAudioNodeId(node._id)}
                  onOpenReassign={() => setReassignNodeId(node._id)}
                  onOpenReplace={() => setReplaceNodeId(node._id)}
                  onOpenDecommission={() => setDecommissionNodeId(node._id)}
                  canOnboard={canOnboard}
                  rebootUnsupported={rebootUnsupportedIds.has(node._id)}
                  onReboot={canOnboard ? () => setRebootNodeId(node._id) : undefined}
                />
              );
            })}
            {filteredNodes?.length === 0 && !isLoading && scopedNodes.length > 0 && (
              <div className="text-center p-8 text-warmGray">
                Không tìm thấy thiết bị nào khớp với bộ lọc.
              </div>
            )}
          </div>
        </div>

        <Modal
          open={showRegister}
          onClose={() => {
            setShowRegister(false);
            setRegisterTarget({});
          }}
          title="Kích hoạt thiết bị"
        >
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="label-caption">Vị trí lắp đặt</label>
              <FarmHouseZonePicker
                value={registerTarget}
                onChange={setRegisterTarget}
              />
            </div>

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
              disabled={!deviceId.trim() || !secretKey.trim() || !registerTarget.zoneId}
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

      </Card>
    </div>
  );
}
