import { Link } from "react-router-dom";
import { useZoneStore } from "@/stores/zoneStore";
import { useTelemetry } from "@/hooks/farm-owner/useTelemetry";
import { useAllZones, useZone } from "@/hooks/shared/useFarms";
import { Badge, Button } from "@/components/ui";
import SensorCard from "@/components/features/farm-owner/dashboard/SensorCard";
import EmptyState from "@/components/ui/EmptyState";
import ZoneOverviewCard from "@/components/features/farm-owner/dashboard/ZoneOverviewCard";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import {
  IconTemp,
  IconHumidity,
  IconLight,
  IconGas,
  IconSound,
} from "@/components/ui/icons";

// Chỉ dùng khi useZone() chưa tải xong (F5 lần đầu) — khớp default trong
// backend/src/models/houseZone.model.ts, KHÔNG phải nguồn thật. Ngưỡng thật
// lấy từ zone.thresholds bên dưới, phản ánh đúng giá trị Farm Owner đã chỉnh
// qua trang Trang trại → Ngưỡng (ENV-FR-006), kể cả sau khi reset (ENV-FR-020).
const FALLBACK_THRESHOLDS = {
  temp_min: 26,
  temp_max: 31,
  humidity_min: 75,
  humidity_max: 95,
  light_max: 0.2,
  nh3_max: 25,
  co2_max: 1500,
};

/** Dashboard – 6 chỉ số realtime của Zone đang chọn (ENV-FR-005) */
export default function FarmOwnerDashboardPage() {
  const { selectedZoneId, selectedZoneName, setZone } = useZoneStore();
  const { data, isLoading, isLive, hasEverReceived } = useTelemetry(
    selectedZoneId ?? undefined,
  );
  const { data: allZones, isLoading: isLoadingAllZones } = useAllZones();
  const { data: zone } = useZone(selectedZoneId ?? undefined);
  const T = zone?.thresholds ?? FALLBACK_THRESHOLDS;

  if (!selectedZoneId) {
    if (isLoadingAllZones) {
      return <LoadingSkeleton count={4} className="h-32 w-full" />;
    }

    if (!allZones?.length) {
      return (
        <EmptyState
          title="Chưa có khu vực nào"
          description="Tạo trang trại, nhà yến và zone để bắt đầu xem số liệu môi trường thời gian thực."
          action={
            <Link to="/farms">
              <Button>Đi tới Trang trại</Button>
            </Link>
          }
        />
      );
    }

    return (
      <div className="flex flex-col gap-5">
        <div className="min-w-0">
          <p className="label-caption">Khu vực đang xem</p>
          <p className="truncate text-2xl font-bold tracking-tight text-charcoal">
            Tất cả nhà yến
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {allZones.map((zone) => (
            <ZoneOverviewCard
              key={zone._id}
              zone={zone}
              onClick={() => setZone(zone.farmId, zone.farmName, zone._id, zone.name)}
            />
          ))}
        </div>
      </div>
    );
  }

  const tempAnomaly =
    data.temperature !== undefined &&
    (data.temperature < T.temp_min || data.temperature > T.temp_max);
  const humidityAnomaly =
    data.humidity !== undefined &&
    (data.humidity < T.humidity_min || data.humidity > T.humidity_max);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caption">Khu vực đang xem</p>
          <p className="truncate text-2xl font-bold tracking-tight text-charcoal">
            {selectedZoneName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data.timestamp && (
            <span className="hidden text-xs text-warmGray sm:block">
              Cập nhật {new Date(data.timestamp).toLocaleTimeString("vi-VN")}
            </span>
          )}
          <Badge
            tone={
              isLive ? "positive" : hasEverReceived ? "critical" : "neutral"
            }
          >
            <span
              className={
                isLive
                  ? "h-1.5 w-1.5 rounded-full bg-charcoal"
                  : hasEverReceived
                    ? "h-1.5 w-1.5 rounded-full bg-alertRed"
                    : "h-1.5 w-1.5 rounded-full bg-warmGray"
              }
            />
            {isLive ? "Live" : hasEverReceived ? "Mất kết nối" : "Đang tải"}
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[136px] animate-pulse rounded-2xl border border-warmGray/15 bg-warmGray/10"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <SensorCard
            label="Nhiệt độ"
            value={data.temperature}
            unit="°C"
            icon={IconTemp}
            range={`${T.temp_min}–${T.temp_max}°C`}
            isAnomaly={tempAnomaly}
          />
          <SensorCard
            label="Độ ẩm"
            value={data.humidity}
            unit="%"
            icon={IconHumidity}
            range={`${T.humidity_min}–${T.humidity_max}%`}
            isAnomaly={humidityAnomaly}
          />
          <SensorCard
            label="Ánh sáng"
            value={data.light_lux}
            unit="lux"
            icon={IconLight}
            range={`< ${T.light_max} lux`}
          />
          <SensorCard
            label="NH3"
            value={data.nh3_ppm}
            unit="ppm"
            icon={IconGas}
            range={`< ${T.nh3_max} ppm`}
            isAnomaly={data.nh3_ppm !== undefined && data.nh3_ppm > T.nh3_max}
          />
          <SensorCard
            label="CO2"
            value={data.co2_ppm}
            unit="ppm"
            decimals={0}
            icon={IconGas}
            range={`< ${T.co2_max} ppm`}
            isAnomaly={data.co2_ppm !== undefined && data.co2_ppm > T.co2_max}
          />
          <SensorCard
            label="Âm thanh"
            value={data.sound_db}
            unit="dB"
            icon={IconSound}
          />
        </div>
      )}
    </div>
  );
}
