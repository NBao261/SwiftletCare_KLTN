import { useState, useMemo } from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { useSensorNodes, useSendNodeCommand } from "@/hooks/shared/useDevices";
import { useScopeFilter } from "@/hooks/shared/useScopeFilter";
import { Button, SearchInput, SectionCard } from "@/components/ui";
import StatusTabs from "@/components/common/StatusTabs";
import ScopeFilter from "@/components/common/ScopeFilter";
import HeaderActions from "@/components/layouts/HeaderActions";
import ConfirmModal from "@/components/ui/ConfirmModal";
import EmptyState from "@/components/ui/EmptyState";
import DeviceListRow, { DEVICE_ROW_GRID } from "@/components/features/technician/devices/DeviceListRow";
import { countByTab, matchesSearch, matchesTab, restartBlockReason, sortDevices, type DeviceTab } from "@/components/features/technician/devices/deviceStatus.utils";
import LullabyTracksModal from "@/components/features/farm-owner/devices/LullabyTracksModal";
import MoveControllerModal from "@/components/features/farm-owner/devices/MoveControllerModal";
import ReplaceControllerModal from "@/components/features/farm-owner/devices/ReplaceControllerModal";
import RemoveControllerModal from "@/components/features/farm-owner/devices/RemoveControllerModal";
import RemovedDevicesSection from "@/components/features/farm-owner/devices/RemovedDevicesSection";
import { sensorItem, type DeviceItem } from "@/components/features/farm-owner/devices/deviceInventory";
import { devicesDict } from "@/constants/devices.i18n";
import { useTranslation } from "@/hooks/common/useTranslation";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useToastStore } from "@/stores/toastStore";
import { getApiErrorMessage } from "@/lib/helpers";

const SEARCH_FROM = 6;

// Thiết bị của Farm Technician: thiết bị các nhà được giao, chẩn đoán, khởi động lại, danh sách bài loa chỉ xem
export default function TechnicianDevicesPage() {
  const { t } = useTranslation(devicesDict);
  const navigate = useNavigate();
  // Chung store phạm vi với các trang khác
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
  const [tab, setTab] = useState<DeviceTab>("ALL");
  const [rebootUnsupportedIds, setRebootUnsupportedIds] = useState<Set<string>>(new Set());
  const sendCommand = useSendNodeCommand();
  const push = useToastStore((s) => s.push);
  const [rebootNodeId, setRebootNodeId] = useState<string | null>(null);
  // Dời, thay, gỡ bộ điều khiển của nhà được giao (FARM-FR-007b, 008)
  const [moveDevice, setMoveDevice] = useState<DeviceItem>();
  const [replaceDevice, setReplaceDevice] = useState<DeviceItem>();
  const [removeDevice, setRemoveDevice] = useState<DeviceItem>();

  // Có vài thiết bị thì cuộn mắt là thấy hết; ô tìm chỉ hiện khi nhiều
  const showSearch = scopedNodes.length > SEARCH_FROM;
  const tabCounts = countByTab(scopedNodes);
  const filteredNodes = sortDevices(scopedNodes.filter(node => matchesTab(node, tab) && matchesSearch(node, searchQuery)));

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
          push(`Đã gửi lệnh tới ${deviceLabel}, thiết bị sẽ tự kết nối lại sau vài giây`);
          setRebootNodeId(null);
        },
        onError: (err) => {
          if ((err as { response?: { status?: number } })?.response?.status === 501) {
            setRebootUnsupportedIds(prev => new Set(prev).add(nodeId));
            push("Firmware chưa hỗ trợ lệnh khởi động lại từ xa", "error");
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

      <SectionCard
        description={t("list.short")}
        action={(
          <Button size="sm" onClick={() => navigate("/devices/onboarding")}>
            <PlusIcon size={14} weight="bold" />
            {t("list.setup")}
          </Button>
        )}
      >
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
          <>
            {/* Số thiết bị mỗi nhóm nằm ngay trên tab; chỉ nhóm cần chú ý mới có số nổi */}
            <StatusTabs
              variant="underline"
              ariaLabel="Lọc thiết bị theo trạng thái"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "ALL", label: `Tất cả (${tabCounts.ALL})` },
                { id: "WARNING", label: "Cần xử lý", badge: tabCounts.WARNING },
                { id: "OFFLINE", label: "Mất kết nối", badge: tabCounts.OFFLINE },
                { id: "PENDING", label: `Chờ kết nối (${tabCounts.PENDING})` },
                { id: "ONLINE", label: `Online (${tabCounts.ONLINE})` },
              ]}
            />

            {showSearch && (
              <div className="max-w-sm">
                <SearchInput placeholder="Tìm mã thiết bị, firmware..." value={searchQuery} onChange={setSearchQuery} />
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-warmGray/15 bg-white">
              <div className={`hidden gap-x-4 border-b border-warmGray/15 bg-warmGray/5 px-4 py-2.5 text-xs font-semibold text-warmGray md:grid ${DEVICE_ROW_GRID}`}>
                <span>Thiết bị</span>
                <span>Vị trí</span>
                <span>Trạng thái</span>
                <span>Kết nối</span>
                <span />
              </div>
              {filteredNodes.map(node => {
                const zone = zoneById.get(node.zone_id);
                return (
                  <DeviceListRow
                    key={node._id}
                    node={node}
                    zoneId={node.zone_id}
                    houseName={zone?.houseName}
                    zoneName={zone?.name}
                    isExpanded={expandedNodeId === node._id}
                    onToggleExpand={() => setExpandedNodeId(prev => prev === node._id ? null : node._id)}
                    onOpenAudio={() => setAudioNodeId(node._id)}
                    rebootBlockedReason={restartBlockReason(node) ?? (rebootUnsupportedIds.has(node._id) ? "Firmware chưa hỗ trợ lệnh này." : null)}
                    onReboot={() => setRebootNodeId(node._id)}
                    moreActions={zone ? [
                      { label: t("action.move"), onClick: () => setMoveDevice(sensorItem(node, zone.house_id)) },
                      { label: t("action.replace"), onClick: () => setReplaceDevice(sensorItem(node, zone.house_id)) },
                      { label: t("action.remove"), onClick: () => setRemoveDevice(sensorItem(node, zone.house_id)), danger: true },
                    ] : undefined}
                  />
                );
              })}
              {filteredNodes.length === 0 && (
                <div className="p-8 text-center text-small text-warmGray">
                  Không có thiết bị nào ở nhóm này{searchQuery.trim() ? " khớp với ô tìm kiếm" : ""}.
                </div>
              )}
            </div>
          </>
        )}

        {audioNode && (
          <LullabyTracksModal
            node={audioNode}
            onClose={() => setAudioNodeId(null)}
          />
        )}

        {moveDevice && <MoveControllerModal device={moveDevice} onClose={() => setMoveDevice(undefined)} />}
        {replaceDevice && <ReplaceControllerModal device={replaceDevice} onClose={() => setReplaceDevice(undefined)} />}
        {removeDevice && <RemoveControllerModal device={removeDevice} onClose={() => setRemoveDevice(undefined)} />}

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

      </SectionCard>
      {/* thiết bị gỡ nhầm khôi phục được trong 24 giờ */}
      <RemovedDevicesSection />
    </div>
  );
}
