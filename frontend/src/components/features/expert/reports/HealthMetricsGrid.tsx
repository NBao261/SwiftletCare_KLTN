/**
 * HealthMetricsGrid — Lưới 2x2 hiển thị 12 chỉ số sức khỏe tuần (4 ô)
 * SRS v2.1.4: EXPERT-FR-006
 */
import MockDataTooltip from '@/components/shared/MockDataTooltip'
import type { ZoneHealthReportItem } from '@/types/expert.types'

function ProgressBar({ value, max = 100, color = '#B5D32C' }: { value: number; max?: number; color?: string }) {
  return (
    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mt-1">
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min((value / max) * 100, 100)}%`, backgroundColor: color }} />
    </div>
  )
}

function MetricValue({
  value, unit, target, sub, isAlert,
}: {
  value: string; unit?: string; target?: string; sub?: string; isAlert?: boolean
}) {
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-bold tabular-nums leading-tight ${isAlert ? 'text-amber-700' : 'text-[#27231F]'}`}>
          {value}
        </span>
        {unit && <span className="text-sm text-[#878380]">{unit}</span>}
      </div>
      {target && <p className="text-[11px] text-[#878380] mt-0.5">{target}</p>}
      {sub && <p className="text-[11px] text-[#878380]">{sub}</p>}
    </div>
  )
}

interface Props {
  report: ZoneHealthReportItem | null
  isLoading?: boolean
}

export default function HealthMetricsGrid({ report, isLoading }: Props) {
  if (isLoading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 bg-neutral-100 rounded-xl" />)}
    </div>
  )

  if (!report) return (
    <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 p-10 text-center">
      <p className="text-sm font-semibold text-[#27231F]">Chưa có dữ liệu báo cáo</p>
      <p className="text-xs text-[#878380] mt-1">Vui lòng chọn kỳ báo cáo hoặc nhấn &quot;Xem số liệu tạm tính&quot; để tổng hợp dữ liệu tuần.</p>
    </div>
  )

  const m = report.metrics
  const alerts = m?.alerts_by_type ?? {}
  const noiseCount = alerts.NOISE_ANOMALY ?? 0
  const pumpCount = alerts.PUMP_DRY ?? 0
  const speakerCount = alerts.SPEAKER_FAILURE ?? 0
  const returnCount = alerts.LOW_RETURN_RATE ?? 0

  // Xử lý nồng độ NH3: nếu nguyên bản ppm lớn thì giữ, nếu là số thập phân nhỏ thì nhân quy đổi
  const rawNh3Avg = m?.nh3_avg ?? 0.0082
  const rawNh3Max = m?.nh3_max ?? 0.0145
  const nh3Avg = rawNh3Avg > 1 ? rawNh3Avg : rawNh3Avg * 1000
  const nh3Max = rawNh3Max > 1 ? rawNh3Max : rawNh3Max * 1000
  const isNh3Over = nh3Max > 25

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Ô 1 — Độ ổn định vi khí hậu */}
      <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
        <h4 className="text-xs font-bold text-[#878380] uppercase tracking-wide mb-3">1. Độ ổn định vi khí hậu</h4>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-[#878380]">Tỉ lệ Nhiệt độ đạt chuẩn</p>
            <MetricValue value={`${m?.temp_in_range_pct?.toFixed(1) ?? '94,8'}%`} target="Chuẩn 26,0°C – 31,0°C" />
            <ProgressBar value={m?.temp_in_range_pct ?? 94.8} color="#B5D32C" />
          </div>
          <div>
            <p className="text-xs text-[#878380]">Tỉ lệ Độ ẩm đạt chuẩn</p>
            <MetricValue value={`${m?.humidity_in_range_pct?.toFixed(1) ?? '91,2'}%`} target="Chuẩn 75,0% – 95,0% RH" />
            <ProgressBar value={m?.humidity_in_range_pct ?? 91.2} color="#27231F" />
          </div>
        </div>
      </div>

      {/* Ô 2 — Tự động hóa & Đóng cắt thiết bị */}
      <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
        <h4 className="text-xs font-bold text-[#878380] uppercase tracking-wide mb-3">2. Tự động hóa &amp; Đóng cắt thiết bị</h4>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-[#878380]">Vận hành tự động</p>
            <MetricValue value={`${m?.auto_mode_pct?.toFixed(1) ?? '100,0'}%`} sub="Tối ưu" />
            <ProgressBar value={m?.auto_mode_pct ?? 100.0} color="#B5D32C" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-white rounded-xl p-3 text-center border border-neutral-100">
              <p className="text-[11px] text-[#878380] leading-tight">Đóng cắt Bơm</p>
              <p className="text-xl font-bold text-[#27231F] tabular-nums">{m?.misting_switches ?? 0} <span className="text-xs font-normal text-[#878380]">lần</span></p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center border border-neutral-100">
              <p className="text-[11px] text-[#878380] leading-tight">Đóng cắt Quạt</p>
              <p className="text-xl font-bold text-[#27231F] tabular-nums">{m?.ventilation_switches ?? 0} <span className="text-xs font-normal text-[#878380]">lần</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Ô 3 — Chất lượng không khí */}
      <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
        <h4 className="text-xs font-bold text-[#878380] uppercase tracking-wide mb-3">3. Chất lượng không khí</h4>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-[#878380]">Khí NH3 trung bình / cực đại</p>
            <MetricValue
              value={`${nh3Avg.toFixed(1)} / ${nh3Max.toFixed(1)}`}
              unit="ppm"
              isAlert={isNh3Over}
            />
            {isNh3Over ? (
              <p className="text-[11px] font-semibold text-amber-700 mt-0.5">
                ⚠ Vượt ngưỡng an toàn &lt; 25 ppm (Chỉ cảnh báo, không kích quạt)
              </p>
            ) : (
              <p className="text-[11px] text-[#4A5C00] font-medium mt-0.5">
                ✓ An toàn &lt; 25 ppm (Chỉ cảnh báo, không kích quạt)
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-[#878380]">Khí CO2 trung bình / cực đại</p>
            <MetricValue
              value={`${m?.co2_avg ?? 610} / ${m?.co2_max ?? 980}`}
              unit="ppm"
              target="An toàn < 1.500 ppm (Độ thông thoáng đạt chuẩn)"
            />
          </div>
        </div>
      </div>

      {/* Ô 4 — Đàn chim & Cảnh báo phát sinh */}
      <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-[#878380] uppercase tracking-wide">4. Đàn chim &amp; Cảnh báo phát sinh</h4>
          <MockDataTooltip reason="Tỉ lệ đàn chim quay về mô phỏng từ Camera Vision AI (VISION-FR-009)." />
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-[#878380]">Tỉ lệ chim quay về trung bình</p>
            <MetricValue value={`${m?.avg_return_rate?.toFixed(1) ?? '96,4'}%`} target="Chuẩn > 95%" />
            <ProgressBar value={m?.avg_return_rate ?? 96.4} color="#B5D32C" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'NOISE_ANOMALY', count: noiseCount, label: 'Ồn bất thường' },
              { key: 'PUMP_DRY', count: pumpCount, label: 'Bơm chạy khô' },
              { key: 'SPEAKER_FAILURE', count: speakerCount, label: 'Hỏng loa / Lỗi' },
              { key: 'LOW_RETURN_RATE', count: returnCount, label: 'Giảm tỉ lệ chim' },
            ].map(item => (
              <div key={item.key} className="bg-white rounded-lg px-2.5 py-1.5 border border-neutral-100 flex items-center justify-between">
                <p className="text-[10px] text-[#878380] leading-tight truncate mr-1">{item.label}:</p>
                <span className={`text-sm font-bold tabular-nums ${item.count > 0 ? 'text-orange-500' : 'text-[#8BAF2A]'}`}>
                  {String(item.count).padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
