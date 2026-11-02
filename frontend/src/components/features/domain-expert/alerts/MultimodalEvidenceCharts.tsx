/**
 * MultimodalEvidenceCharts — Bằng chứng đối chiếu đa phương thức (Bước 1 Drawer 02B)
 * Kết nối GET /alerts/{id}/evidence (ALERT-FR-014, EXPERT-FR-003)
 * Xử lý nguồn dữ liệu 'missing' (không phải 0) và hiển thị tối đa 10 kết luận tiền lệ
 */
import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, Cell, ResponsiveContainer,
} from 'recharts'
import { AlertTriangle, Clock, History, AlertCircle, ShieldAlert, Cpu } from 'lucide-react'
import MockDataTooltip from '@/components/shared/MockDataTooltip'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import type { InferredAlertItem } from '@/types/expert.types'
import { useAlertEvidence } from '@/hooks/domain-expert/useExpertAlerts'
import { buildAlertEvidence, type EvidenceSource } from './alertEvidence'
import { formatDate } from '@/lib/helpers'

interface Props { alert: InferredAlertItem }

function ChartTooltip({ active, payload, label, unit }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string; unit: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-neutral-200 rounded-lg px-3 py-1.5 shadow-lg text-xs">
      <p className="font-semibold text-[#27231F]">{label}</p>
      <p className="text-[#878380]">Giá trị: <b className="text-[#27231F]">{payload[0].value}{unit}</b></p>
    </div>
  )
}

function EvidenceBarCard({ src, dotColor }: { src: EvidenceSource; dotColor: string }) {
  return (
    <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
          <span className="text-xs font-semibold text-[#27231F] whitespace-nowrap">{src.title}</span>
          <MockDataTooltip reason="Dữ liệu chuỗi thời gian được chuẩn hóa từ telemetry cảm biến và AI đối chứng." />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#878380] shrink-0">
          <span>{src.badge1}</span>
          <span className="text-neutral-300">|</span>
          <span>{src.badge2}</span>
          {src.highlight && (
            <>
              <span className="text-neutral-300">|</span>
              <span className="text-red-600 font-semibold">{src.highlight}</span>
            </>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={src.data} barCategoryGap="25%" margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} interval={2} />
          <YAxis
            domain={src.domain}
            ticks={src.ticks}
            interval={0}
            tick={{ fontSize: 10, fill: '#878380' }}
            axisLine={false}
            tickLine={false}
            unit={src.unit}
          />
          <Tooltip content={<ChartTooltip unit={src.unit} />} />
          <ReferenceLine y={src.refY} stroke="#F59E0B" strokeDasharray="4 3" strokeWidth={1.5}
            label={{ value: src.refLabel, position: 'insideTopRight', fontSize: 9, fill: '#B45309' }} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {src.data.map((entry, i) => (
              <Cell key={i} fill={entry.isAnomaly ? '#D53F35' : (src.barColor ?? '#D4D0CB')} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex justify-center mt-1">
        <span className="text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded px-2 py-0.5">
          {src.anomalyTag}
        </span>
      </div>
    </div>
  )
}

function MissingBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-800">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>{label}</span>
      </div>
      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-200/80 text-amber-900 uppercase">
        missing
      </span>
    </div>
  )
}

export default function MultimodalEvidenceCharts({ alert }: Props) {
  const { data: evidence, isLoading } = useAlertEvidence(alert._id)

  // Dữ liệu đồ thị mô phỏng / bổ trợ khi không có telemetry samples
  const fallbackCfg = useMemo(() => buildAlertEvidence(alert), [alert])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <LoadingSkeleton count={2} className="h-28 w-full rounded-xl" />
        <LoadingSkeleton count={1} className="h-16 w-full rounded-xl" />
      </div>
    )
  }

  const isLowReturn = alert.type === 'LOW_RETURN_RATE'
  const telemetryMissing = evidence?.telemetry?.status === 'missing'
  const birdCountsMissing = evidence?.bird_counts?.status === 'missing'

  return (
    <div className="space-y-4">
      {/* ── 1. ĐỐI CHIẾU DỮ LIỆU ĐO ĐẠC / TELEMETRY ── */}
      {isLowReturn ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider">
                % Thời gian trong ngưỡng theo từng Zone trong ngày
              </h4>
              <span className="text-[11px] text-warmGray">Chuẩn nền: 95%</span>
            </div>
            {evidence?.zones_in_range && evidence.zones_in_range.length > 0 ? (
              <div className="divide-y divide-neutral-100">
                {evidence.zones_in_range.map(z => (
                  <div key={z.zone_id} className="py-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-charcoal">{z.name}</span>
                    {z.status === 'missing' ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-neutral-100 text-warmGray">
                        Thiếu dữ liệu (missing)
                      </span>
                    ) : (
                      <div className="flex items-center gap-3 text-xs">
                        <span>Nhiệt độ: <b className="text-charcoal">{z.temp_in_range_pct ?? '—'}%</b></span>
                        <span className="text-neutral-300">|</span>
                        <span>Độ ẩm: <b className="text-charcoal">{z.humidity_in_range_pct ?? '—'}%</b></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-warmGray italic">Không có dữ liệu zone trong ngày</p>
            )}
          </div>

          {/* Cảnh báo tiếng ồn và thiết bị trong ngày của nhà */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/60">
              <div className="flex items-center gap-1.5 font-semibold text-charcoal mb-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Cảnh báo tiếng ồn trong ngày</span>
              </div>
              {evidence?.noise_alerts && evidence.noise_alerts.length > 0 ? (
                <ul className="space-y-1">
                  {evidence.noise_alerts.map(a => (
                    <li key={a._id} className="text-[11.5px] text-warmGray flex justify-between">
                      <span className="truncate">{a.title}</span>
                      <span className="shrink-0">{formatDate(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-warmGray text-[11.5px]">Không có sự cố tiếng ồn</p>
              )}
            </div>

            <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/60">
              <div className="flex items-center gap-1.5 font-semibold text-charcoal mb-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-600" />
                <span>Cảnh báo thiết bị trong ngày</span>
              </div>
              {evidence?.device_alerts && evidence.device_alerts.length > 0 ? (
                <ul className="space-y-1">
                  {evidence.device_alerts.map(a => (
                    <li key={a._id} className="text-[11.5px] text-warmGray flex justify-between">
                      <span className="truncate">{a.title}</span>
                      <span className="shrink-0">{formatDate(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-warmGray text-[11.5px]">Thiết bị vận hành ổn định</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Nguồn 1: Cảm biến & Telemetry */}
          {telemetryMissing ? (
            <MissingBadge label="Nguồn 1 (Telemetry cảm biến ±30 phút): Không có mẫu ghi nhận" />
          ) : (
            <EvidenceBarCard src={fallbackCfg.src1} dotColor="bg-[#27231F]" />
          )}

          {/* Nguồn 2: Dữ liệu đối chứng / Đếm chim */}
          {birdCountsMissing ? (
            <MissingBadge label="Nguồn 2 (Số đếm chim 5 phút ±30 phút): Không có chuỗi đếm" />
          ) : (
            <EvidenceBarCard src={fallbackCfg.src2} dotColor="bg-[#B5D32C]" />
          )}

          {/* Cảnh báo thiết bị đang mở tại khu vực */}
          {evidence?.device_alerts && evidence.device_alerts.length > 0 && (
            <div className="p-3 rounded-xl border border-red-200 bg-red-50/40 text-xs text-charcoal">
              <div className="flex items-center gap-1.5 font-semibold text-red-700 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Thiết bị đang có cảnh báo mở tại khu vực này:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-warmGray text-[11.5px]">
                {evidence.device_alerts.map(da => (
                  <li key={da._id}>
                    <span className="font-medium text-charcoal">{da.title}</span> — {da.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Hộp tương quan / chẩn đoán */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex gap-3">
        <span className="mt-0.5 flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        </span>
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Chẩn đoán nguyên nhân:</strong> {fallbackCfg.correlation}
        </p>
      </div>

      {/* ── 2. TỐI ĐA 10 KẾT LUẬN TIỀN LỆ (EXPERT-FR-003, ALERT-FR-014) ── */}
      <div className="rounded-xl border border-neutral-200 bg-white p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-charcoal" />
            <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider">
              Kết luận tiền lệ cùng loại tại khu vực (EXPERT-FR-003)
            </h4>
          </div>
          <span className="text-[11px] font-medium text-warmGray">
            {evidence?.earlier_verdicts?.length ?? 0}/10 kết luận gần nhất
          </span>
        </div>

        {evidence?.earlier_verdicts && evidence.earlier_verdicts.length > 0 ? (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {evidence.earlier_verdicts.map(item => {
              const v = item.expert_verdict
              const isConfirmed = v?.result === 'CONFIRMED'
              const authorName = typeof v?.by === 'object' ? v.by?.full_name : 'Chuyên gia'
              const authorRole = v?.role === 'FARM_OWNER' ? 'Chủ nhà yến' : 'Chuyên gia'

              return (
                <div
                  key={item._id}
                  className="p-2.5 rounded-lg border border-neutral-100 bg-neutral-50/70 flex flex-col gap-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                          isConfirmed
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-neutral-200 text-neutral-700 border border-neutral-300'
                        }`}
                      >
                        {isConfirmed ? 'ĐÃ XÁC NHẬN' : 'ĐÃ BÁC BỎ'}
                      </span>
                      <span className="font-semibold text-charcoal">
                        {authorName} <span className="text-[11px] font-normal text-warmGray">({authorRole})</span>
                      </span>
                    </div>
                    <span className="text-[11px] text-warmGray flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {v?.at ? formatDate(v.at) : formatDate(item.created_at)}
                    </span>
                  </div>
                  {v?.note && (
                    <p className="text-[11.5px] text-graphite bg-white/80 p-2 rounded border border-neutral-100 italic">
                      "{v.note}"
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-warmGray italic py-1">
            Chưa có tiền lệ kết luận thẩm định cho loại cảnh báo này tại khu vực (hệ thống sẽ lưu lại sau khi bạn thẩm định).
          </p>
        )}
      </div>
    </div>
  )
}
