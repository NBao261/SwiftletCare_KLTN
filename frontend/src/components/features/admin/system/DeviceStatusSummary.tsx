// Admin — trạng thái mọi node toàn hệ thống (OPS-NFR-004), tách khỏi trang riêng
// để làm 1 section của AdminSystemHealthPage (SYSTEM-FR-003) — vẫn dùng hook thật.
import { useSystemNodeStatus } from "@/hooks/shared/useDevices";
import { Card, Badge } from "@/components/ui";
import { IconDevice } from "@/components/ui/icons";
import StatusDot from "@/components/common/StatusDot";
import EmptyState from "@/components/ui/EmptyState";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { formatDate } from "@/lib/helpers";
import type { SystemNodeStatus, SystemNodeStatusItem } from "@/types";

const SUMMARY_ITEMS: Array<{
  key: keyof ReturnType<typeof emptySummary>;
  label: string;
}> = [
  { key: "total", label: "Tổng số" },
  { key: "online", label: "Online" },
  { key: "offline", label: "Offline" },
  { key: "error", label: "Lỗi" },
  { key: "degraded", label: "Suy giảm" },
  { key: "pending", label: "Chờ kết nối" },
];

function emptySummary() {
  return { total: 0, online: 0, offline: 0, error: 0, degraded: 0, pending: 0 };
}

/**
 * `summary` (tuỳ chọn) — số liệu tóm tắt do trang cha truyền vào, để các thẻ đếm
 * lấy cùng nguồn với Farm/Zone bên cạnh (AdminSystemHealthPage dùng `devices` của
 * health-overview). Không truyền thì dùng tóm tắt của chính danh sách node.
 */
export default function DeviceStatusSummary({ summary: summaryOverride }: { summary?: SystemNodeStatus["summary"] }) {
  const { data, isLoading } = useSystemNodeStatus();
  const summary = summaryOverride ?? data?.summary ?? emptySummary();

  return (
    <div className="flex flex-col gap-3">
      <p className="label-caption">Thiết bị</p>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {SUMMARY_ITEMS.map(({ key, label }) => (
          <Card key={key} className="text-center">
            <p className="text-2xl font-extrabold text-charcoal">
              {summary[key]}
            </p>
            <p className="mt-1 text-xs text-warmGray">{label}</p>
          </Card>
        ))}
      </div>

      {isLoading && <LoadingSkeleton count={4} className="h-16 w-full" />}

      {!isLoading && data?.nodes.length === 0 && (
        <EmptyState
          icon={<IconDevice width={28} height={28} />}
          title="Chưa có thiết bị nào trong hệ thống"
          description="Thiết bị sẽ xuất hiện ở đây ngay khi Technician kích hoạt qua Web Console Onboarding."
        />
      )}

      <div className="flex flex-col gap-2">
        {data?.nodes.map((node) => (
          <NodeRow key={`${node.type}-${node._id}`} node={node} />
        ))}
      </div>
    </div>
  );
}

function NodeRow({ node }: { node: SystemNodeStatusItem }) {
  return (
    <Card className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warmGray/10 text-charcoal">
          <IconDevice />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-bold text-charcoal">{node.device_id}</p>
            <Badge tone="neutral">
              {node.type === "sensor" ? "Sensor" : "Camera"}
            </Badge>
          </div>
          <p className="truncate text-xs text-warmGray">
            {node.farm_name} › {node.house_name} › {node.zone_name}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusDot status={node.status} />
        <span className="text-[11px] text-warmGray">
          {node.type === "sensor" && node.rssi !== undefined
            ? `RSSI ${node.rssi} dBm · `
            : ""}
          {node.last_heartbeat
            ? formatDate(node.last_heartbeat)
            : "Chưa từng kết nối"}
        </span>
      </div>
    </Card>
  );
}
