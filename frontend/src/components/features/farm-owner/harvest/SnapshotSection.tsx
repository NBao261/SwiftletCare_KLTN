import { formatSensor, formatReturnRate } from "@/lib/helpers";
import type { HarvestBatch } from "@/types";

export default function SnapshotSection({ batch }: { batch: HarvestBatch }) {
  const { env_snapshot: env, flock_snapshot: flock } = batch;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-warmGray/15 p-4">
        <p className="label-caption mb-2">
          Môi trường TB 7 ngày trước thu hoạch
        </p>
        {env.insufficient_data ? (
          <p className="text-sm text-warmGray">
            Chưa đủ dữ liệu (zone mới lắp thiết bị gần đây)
          </p>
        ) : (
          <ul className="space-y-1 text-sm text-charcoal">
            <li>Nhiệt độ: {formatSensor(env.avg_temperature, "°C")}</li>
            <li>Độ ẩm: {formatSensor(env.avg_humidity, "%")}</li>
            <li>NH3: {formatSensor(env.avg_nh3_ppm, "ppm")}</li>
            <li>CO2: {formatSensor(env.avg_co2_ppm, "ppm", 0)}</li>
          </ul>
        )}
      </div>
      <div className="rounded-xl border border-warmGray/15 p-4">
        <p className="label-caption mb-2">Đàn chim TB 30 ngày</p>
        {flock.avg_return_rate_30d === undefined ? (
          <p className="text-sm text-warmGray">
            Chưa có dữ liệu (cần module VISION)
          </p>
        ) : (
          <ul className="space-y-1 text-sm text-charcoal">
            <li>Return rate: {formatReturnRate(flock.avg_return_rate_30d)}</li>
            <li>Số lượng ước tính: {flock.estimated_population ?? "--"}</li>
          </ul>
        )}
      </div>
    </div>
  );
}
