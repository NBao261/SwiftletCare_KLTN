import { Link } from "react-router-dom";
import { useZoneStore } from "@/store/zoneStore";
import { useTelemetry } from "@/hooks/useTelemetry";
import { Badge, Button } from "@/components/ui";
import SensorCard from "@/components/common/SensorCard";
import EmptyState from "@/components/common/EmptyState";

const ZONE_THRESHOLDS_DEFAULT = {
  temp_min: 26,
  temp_max: 31,
  humidity_min: 75,
  humidity_max: 95,
  nh3_max: 25,
  co2_max: 1500,
};

/** Dashboard – 6 chỉ số realtime của Zone đang chọn (ENV-FR-005) */
export default function DashboardPage() {
  const { selectedZoneId, selectedZoneName } = useZoneStore();
  const { data, isLoading, isLive, hasEverReceived } = useTelemetry(
    selectedZoneId ?? undefined,
  );

  if (!selectedZoneId) {
    return (
      <EmptyState
        title="Chưa chọn Zone nào"
        description="Vào trang Trang trại, chọn 1 zone rồi bấm “Dashboard” để xem số liệu realtime."
        action={
          <Link to="/farms">
            <Button>Đi tới Trang trại</Button>
          </Link>
        }
      />
    );
  }

  const t = ZONE_THRESHOLDS_DEFAULT;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">
            {selectedZoneName}
          </h1>
          <p className="mt-1 text-sm text-warmGray">
            Dữ liệu môi trường thời gian thực
          </p>
        </div>
        <Badge tone={isLive ? "positive" : hasEverReceived ? "critical" : "neutral"}>
          {isLive
            ? "● Live"
            : hasEverReceived
              ? "● Mất kết nối"
              : "Đang tải..."}
        </Badge>
      </div>

      {isLoading ? (
        <p className="text-sm text-warmGray">Đang tải dữ liệu...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <SensorCard
            label="Nhiệt độ"
            value={data.temperature}
            unit="°C"
            isAnomaly={
              data.temperature !== undefined &&
              (data.temperature < t.temp_min || data.temperature > t.temp_max)
            }
          />
          <SensorCard
            label="Độ ẩm"
            value={data.humidity}
            unit="%"
            isAnomaly={
              data.humidity !== undefined &&
              (data.humidity < t.humidity_min || data.humidity > t.humidity_max)
            }
          />
          <SensorCard
            label="Ánh sáng"
            value={data.light_lux}
            unit="lux"
            decimals={1}
          />
          <SensorCard
            label="NH3"
            value={data.nh3_ppm}
            unit="ppm"
            isAnomaly={data.nh3_ppm !== undefined && data.nh3_ppm > t.nh3_max}
          />
          <SensorCard
            label="CO2"
            value={data.co2_ppm}
            unit="ppm"
            decimals={0}
            isAnomaly={data.co2_ppm !== undefined && data.co2_ppm > t.co2_max}
          />
          <SensorCard label="Âm thanh" value={data.sound_db} unit="dB" />
        </div>
      )}

      {data.timestamp && (
        <p className="text-xs text-warmGray">
          Cập nhật lúc {new Date(data.timestamp).toLocaleTimeString("vi-VN")}
        </p>
      )}
    </div>
  );
}
