import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useSensorNodes, useSendNodeCommand } from "@/hooks/shared/useDevices";
import { useFarms, useHouses, useZones, useAllZones } from "@/hooks/shared/useFarms";
import { Button, Card, SelectMenu } from "@/components/ui";
import { Home } from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import EmptyState from "@/components/ui/EmptyState";
import SystemHealthBar, { needsAttention } from "@/components/features/technician/devices/SystemHealthBar";
import DeviceFilterToolbar, { type DeviceSortKey } from "@/components/features/technician/devices/DeviceFilterToolbar";
import type { SortDirection } from "@/types";
import DeviceListRow from "@/components/features/technician/devices/DeviceListRow";
import LullabyTracksModal from "@/components/features/farm-owner/devices/LullabyTracksModal";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useToastStore } from "@/stores/toastStore";
import { getApiErrorMessage } from "@/lib/helpers";

// Thiết bị của Farm Technician (Report 4 §5.4): thiết bị các nhà được giao, chẩn đoán, khởi động lại, danh sách bài loa chỉ xem
export default function TechnicianDevicesPage() {
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


  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<DeviceSortKey>("last_heartbeat");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [rebootUnsupportedIds, setRebootUnsupportedIds] = useState<Set<string>>(new Set());
  const sendCommand = useSendNodeCommand();
  const push = useToastStore((s) => s.push);
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


  const [audioNodeId, setAudioNodeId] = useState<string | null>(null);
  const audioNode = nodes?.find((n) => n._id === audioNodeId);
  const rebootNode = nodes?.find((n) => n._id === rebootNodeId) ?? null;

  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

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
            <Home size={18} className="text-warmGray" />
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
                { value: '', label: 'Tất cả nhà' },
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
                { value: '', label: 'Tất cả zone' },
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
      </div>

      <Card size="lg" className="pb-10 flex flex-col gap-5">
        {isLoading && <LoadingSkeleton count={2} className="h-40 w-full" />}

        {!isLoading && scopedNodes.length === 0 && (
          <EmptyState
            title={hasLocationFilter ? "Khu vực này chưa có thiết bị" : "Chưa có thiết bị nào"}
            description={
              hasLocationFilter
                ? "Khu vực đang lọc chưa có bộ điều khiển nào."
                : "Các nhà được giao cho bạn chưa có bộ điều khiển nào. Chủ trang trại lắp thiết bị cho từng khu vực."
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
                  rebootUnsupported={rebootUnsupportedIds.has(node._id)}
                  onReboot={() => setRebootNodeId(node._id)}
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

        {audioNode && (
          <LullabyTracksModal
            node={audioNode}
            onClose={() => setAudioNodeId(null)}
          />
        )}

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
