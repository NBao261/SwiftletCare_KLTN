import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useZoneStore } from "@/stores/zoneStore";
import { useTelemetry } from "@/hooks/farm-owner/useTelemetry";
import { useAllZones, useZone } from "@/hooks/shared/useFarms";
import { Button } from "@/components/ui";
import EmptyState from "@/components/ui/EmptyState";
import ZoneOverviewCard from "@/components/features/farm-owner/dashboard/ZoneOverviewCard";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import ScadaModeBanner from "@/components/features/farm-owner/dashboard/ScadaModeBanner";
import EcoHealthCard from "@/components/features/farm-owner/dashboard/EcoHealthCard";
import ControlSubsystemPanel from "@/components/features/farm-owner/dashboard/ControlSubsystemPanel";
import EnvSensorPanel from "@/components/features/farm-owner/dashboard/EnvSensorPanel";
import BirdVisionCard from "@/components/features/farm-owner/dashboard/BirdVisionCard";
import NestingDensityCard from "@/components/features/farm-owner/dashboard/NestingDensityCard";
import SensorAlertLogTable from "@/components/features/farm-owner/dashboard/SensorAlertLogTable";

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
  const { selectedZoneId, selectedZoneName, setZone, clearZone } = useZoneStore();
  const { data, isLoading, isLive, hasEverReceived, relayStates, controlMode } = useTelemetry(
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

  const tooCold = data.temperature !== undefined && data.temperature < T.temp_min;
  const tooHot = data.temperature !== undefined && data.temperature > T.temp_max;
  const tempAnomaly = tooCold || tooHot;
  const humidityAnomaly =
    data.humidity !== undefined &&
    (data.humidity < T.humidity_min || data.humidity > T.humidity_max);
  const nh3Anomaly =
    data.nh3_ppm !== undefined && data.nh3_ppm > T.nh3_max;
  const co2Anomaly =
    data.co2_ppm !== undefined && data.co2_ppm > T.co2_max;

  if (isLoading) {
    return <LoadingSkeleton count={4} className="h-40 w-full" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-[5px]">
        {/* Quay lại trong phạm vi trang Dashboard (về lưới "Tất cả nhà yến"), không phải lịch sử trình duyệt */}
        <button
          onClick={() => clearZone()}
          aria-label="Quay lại Tất cả nhà yến"
          title="Quay lại Tất cả nhà yến"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-warmGray/15 bg-white text-charcoal shadow-icon transition-colors hover:bg-warmGray/10"
        >
          <ArrowLeft width={18} height={18} />
        </button>

        <div className="min-w-0 flex-1">
          <ScadaModeBanner
            isLive={isLive}
            hasEverReceived={hasEverReceived}
            lastSyncedAt={data.timestamp}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <EcoHealthCard
          humidity={data.humidity}
          temperature={data.temperature}
          nh3={data.nh3_ppm}
          humidityAnomaly={humidityAnomaly}
          temperatureAnomaly={tempAnomaly}
          nh3Anomaly={nh3Anomaly}
        />
        <ControlSubsystemPanel
          zoneName={selectedZoneName ?? undefined}
          relayStates={relayStates}
          controlMode={controlMode}
          tooHot={tooHot}
          tooCold={tooCold}
        />
      </div>

      <EnvSensorPanel
        temperature={data.temperature}
        humidity={data.humidity}
        lightLux={data.light_lux}
        nh3={data.nh3_ppm}
        co2={data.co2_ppm}
        soundDb={data.sound_db}
        temperatureAnomaly={tempAnomaly}
        humidityAnomaly={humidityAnomaly}
        nh3Anomaly={nh3Anomaly}
        co2Anomaly={co2Anomaly}
        thresholds={T}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <BirdVisionCard />
        <NestingDensityCard />
      </div>

      <SensorAlertLogTable />
    </div>
  );
}
