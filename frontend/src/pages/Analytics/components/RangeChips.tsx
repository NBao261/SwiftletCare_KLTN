import { cn } from "@/utils/cn";
import { RANGES } from "../constants";
import type { AnalyticsRange } from "@/services/api/analytics";

/** 5 mốc thời gian (1h/6h/24h/7d/30d) — dùng cho EnvTab/CompareTab. KHÔNG dùng cho BirdTab
 *  (chỉ có 2 giá trị 7d/30d, xem BirdRangeToggle riêng). */
export default function RangeChips({
  range,
  onChange,
}: {
  range: AnalyticsRange;
  onChange: (r: AnalyticsRange) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full border border-warmGray/15 p-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
            range === r.value
              ? "bg-charcoal text-white"
              : "text-warmGray hover:bg-warmGray/10",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
