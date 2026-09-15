import { Link } from "react-router-dom";
import { useZoneStore } from "@/store/zoneStore";
import { useTelemetry } from "@/hooks/useTelemetry";
import { Badge, Button } from "@/components/ui";
import SensorCard from "@/components/common/SensorCard";
import EmptyState from "@/components/common/EmptyState";
import {
  IconTemp, IconHumidity, IconLight, IconGas, IconSound,
} from "@/components/ui/icons";

const T = {
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
        title="Chưa chọn khu vực nào"
        description="Chọn khu vực ở thanh trên cùng để xem số liệu môi trường thời gian thực, hoặc tạo trang trại mới nếu bạn vừa bắt đầu."
        action={
          <Link to="/farms">
            <Button>Đi tới Trang trại</Button>
          </Link>
        }
      />
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
            tone={isLive ? "positive" : hasEverReceived ? "critical" : "neutral"}
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
            label="Nhiệt độ" value={data.temperature} unit="°C" icon={IconTemp}
            range={`${T.temp_min}–${T.temp_max}°C`} isAnomaly={tempAnomaly}
          />
          <SensorCard
            label="Độ ẩm" value={data.humidity} unit="%" icon={IconHumidity}
            range={`${T.humidity_min}–${T.humidity_max}%`} isAnomaly={humidityAnomaly}
          />
          <SensorCard
            label="Ánh sáng" value={data.light_lux} unit="lux" icon={IconLight}
            range="< 0.2 lux"
          />
          <SensorCard
            label="NH3" value={data.nh3_ppm} unit="ppm" icon={IconGas}
            range={`< ${T.nh3_max} ppm`}
            isAnomaly={data.nh3_ppm !== undefined && data.nh3_ppm > T.nh3_max}
          />
          <SensorCard
            label="CO2" value={data.co2_ppm} unit="ppm" decimals={0} icon={IconGas}
            range={`< ${T.co2_max} ppm`}
            isAnomaly={data.co2_ppm !== undefined && data.co2_ppm > T.co2_max}
          />
          <SensorCard
            label="Âm thanh" value={data.sound_db} unit="dB" icon={IconSound}
          />
        </div>
      )}
    </div>
  );
}
