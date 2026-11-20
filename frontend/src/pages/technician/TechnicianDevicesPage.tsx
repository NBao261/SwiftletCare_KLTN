import { useState, useMemo } from "react";
import { useSensorNodes, useSendNodeCommand } from "@/hooks/shared/useDevices";
import { useScopeFilter } from "@/hooks/shared/useScopeFilter";
import { Button, Card } from "@/components/ui";
import ScopeFilter from "@/components/common/ScopeFilter";
import HeaderActions from "@/components/layouts/HeaderActions";
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
  // Phạm vi Trang trại → Nhà → Zone trên header, chung store với các trang khác (trang Nhà được giao mở sẵn đúng nhà)
  const scope = useScopeFilter();
  const zoneId = scope.zone?._id;

  // Zone trong phạm vi đang chọn, kèm tên để ghi vị trí từng thiết bị
  const zoneById = useMemo(() => new Map(scope.zones.map(zone => [zone._id, zone])), [scope.zones]);

  // Chọn 1 Zone thì backend lọc theo Zone; còn lại lấy mọi thiết bị của các nhà được giao rồi lọc theo phạm vi
  const { data: nodes, isLoading, isError, refetch } = useSensorNodes(zoneId);
  const scopedNodes = useMemo(() => (nodes ?? []).filter(node => zoneById.has(node.zone_id)), [nodes, zoneById]);
  const loading = isLoading || scope.isLoading;
  // Lỗi tải Zone làm mất cả danh sách (lọc theo Zone), nên báo lỗi thay vì báo "chưa có thiết bị" (FE_Design 13.5)
  const failed = isError || scope.isError;
  function retry() {
    void refetch();
    scope.refetch();
  }

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

  // Câu trạng thái rỗng theo bậc đang lọc: Zone, nhà hay trang trại
  let emptyTitle = "Chưa có thiết bị nào";
  let emptyDescription = "Các nhà được giao cho bạn chưa có bộ điều khiển nào. Chủ nhà yến lắp thiết bị cho từng Zone.";
  if (scope.zone) [emptyTitle, emptyDescription] = ["Zone này chưa có thiết bị", "Zone đang chọn chưa có bộ điều khiển nào."];
  else if (scope.houseId) [emptyTitle, emptyDescription] = ["Nhà này chưa có thiết bị", "Nhà đang chọn chưa có bộ điều khiển nào."];
  else if (scope.farmId) [emptyTitle, emptyDescription] = ["Trang trại này chưa có thiết bị", "Các nhà được giao ở trang trại này chưa có bộ điều khiển nào."];

  return (
    <div className="flex flex-col gap-6">
      {/* Khung lọc nằm trên header từ sm trở lên như các trang Farm Owner; mobile header chật nên đặt đầu trang */}
      <HeaderActions>
        <div className="hidden sm:block">
          <ScopeFilter scope={scope} />
        </div>
      </HeaderActions>
      <div className="sm:hidden">
        <ScopeFilter scope={scope} />
      </div>

      <Card size="lg" className="pb-10 flex flex-col gap-5">
        {loading && <LoadingSkeleton count={2} className="h-40 w-full" />}

        {!loading && failed && (
          <EmptyState
            title="Không tải được thiết bị"
            description="Kiểm tra kết nối tới máy chủ rồi thử lại."
            action={<Button variant="secondary" size="sm" onClick={retry}>Thử lại</Button>}
          />
        )}

        {!loading && !failed && scopedNodes.length === 0 && <EmptyState title={emptyTitle} description={emptyDescription} />}

        {!loading && !failed && scopedNodes.length > 0 && (
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

        {!loading && !failed && scopedNodes.length > 0 && <div className="flex flex-col pb-8">
          <div className="bg-white border border-warmGray/15 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            {filteredNodes?.map((node, i) => {
              const zone = zoneById.get(node.zone_id);
              const locationLabel = zone ? `${zone.farmName} · ${zone.houseName} · ${zone.name}` : undefined;

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
            {filteredNodes.length === 0 && (
              <div className="text-center p-8 text-warmGray">
                Không tìm thấy thiết bị nào khớp với bộ lọc.
              </div>
            )}
          </div>
        </div>}

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
