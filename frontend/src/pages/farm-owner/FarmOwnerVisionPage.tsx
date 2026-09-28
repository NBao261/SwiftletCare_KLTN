import { useState } from "react";
import { useZoneStore } from "@/stores/zoneStore";
import { cn } from "@/lib/cn";
import EmptyState from "@/components/ui/EmptyState";
import LiveCameraCard from "@/components/features/farm-owner/vision/LiveCameraCard";
import BirdStatsCards from "@/components/features/farm-owner/vision/BirdStatsCards";
import BirdTrendChart from "@/components/features/farm-owner/vision/BirdTrendChart";
import SavedEventsTable from "@/components/features/farm-owner/vision/SavedEventsTable";

/** Giám sát đàn chim – VISION-FR-006/008/009/010/011/013 */
export default function FarmOwnerVisionPage() {
  const { selectedZoneId, selectedZoneName } = useZoneStore();
  // Phóng to camera: dồn khung video full chiều ngang, 3 card Entry/Exit/Return
  // rate chuyển từ xếp dọc bên cạnh sang xếp ngang bên dưới (không dùng Fullscreen API).
  const [cameraExpanded, setCameraExpanded] = useState(false);

  if (!selectedZoneId) {
    return (
      <EmptyState
        title="Chưa chọn khu vực nào"
        description="Chọn khu vực ở thanh trên cùng để xem camera và số liệu đàn chim."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        className={cn(
          "grid grid-cols-1 gap-5",
          !cameraExpanded && "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
        )}
      >
        <LiveCameraCard
          zoneName={selectedZoneName ?? ""}
          expanded={cameraExpanded}
          onToggleExpand={() => setCameraExpanded((v) => !v)}
        />
        <BirdStatsCards zoneId={selectedZoneId} horizontal={cameraExpanded} />
      </div>

      <BirdTrendChart zoneId={selectedZoneId} />

      <SavedEventsTable />
    </div>
  );
}
