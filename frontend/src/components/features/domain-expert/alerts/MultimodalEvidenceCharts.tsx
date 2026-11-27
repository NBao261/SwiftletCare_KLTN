// Bằng chứng của cảnh báo; nguồn 'missing' không phải 0
import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell, ResponsiveContainer } from 'recharts'
import { WarningCircleIcon } from '@phosphor-icons/react'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import { Badge } from '@/components/ui'
import type { InferredAlertItem } from '@/types/expert.types'
import { useAlertEvidence } from '@/hooks/domain-expert/useExpertAlerts'
import { buildAlertEvidence, type EvidenceSource } from './alertEvidence'
import { formatDate } from '@/lib/helpers'
import OnsiteCheckSection from '@/components/common/OnsiteCheckSection'
import { t } from '@/i18n'

interface Props { alert: InferredAlertItem }

// Số kết luận cũ hiện sẵn, còn lại bấm "Xem thêm"
const VISIBLE_VERDICTS = 3

function ChartTooltip({ active, payload, label, unit }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string; unit: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-warmGray/15 bg-white px-3 py-1.5 text-xs shadow-lg">
      <p className="font-semibold text-charcoal">{label}</p>
      <p className="text-warmGray">{t('Giá trị:')} <b className="text-charcoal">{payload[0].value}{unit}</b></p>
    </div>
  )
}

// Một nguồn số liệu: tên và điểm nổi bật ở đầu, biểu đồ cột; cột bất thường tô đỏ, vạch cam là trung bình
function EvidenceBarCard({ src }: { src: EvidenceSource }) {
  return (
    <div className="rounded-2xl border border-warmGray/15 p-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <h4 className="text-sm font-semibold text-charcoal">{src.title}</h4>
        {src.highlight && <span className="text-sm font-semibold text-alertRed">{src.highlight}</span>}
      </div>
      <p className="mb-2 text-xs text-warmGray">{src.badge1} · {src.badge2}</p>

      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={src.data} barCategoryGap="25%" margin={{ top: 10, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEAEA" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} interval={2} />
          <YAxis domain={src.domain} ticks={src.ticks} interval={0} tick={{ fontSize: 10, fill: '#878380' }} axisLine={false} tickLine={false} unit={src.unit} />
          <Tooltip content={<ChartTooltip unit={src.unit} />} />
          {src.refY !== undefined && (
            <ReferenceLine y={src.refY} stroke="#F59E0B" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: src.refLabel, position: 'insideTopRight', fontSize: 9, fill: '#B45309' }} />
          )}
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {src.data.map((entry, index) => (
              <Cell key={index} fill={entry.isAnomaly ? '#D53F35' : (src.barColor ?? '#D4D0CB')} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Nguồn không có số liệu: nói rõ thiếu, không vẽ như bằng 0
function MissingNote({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-warmGray/15 bg-warmGray/5 px-4 py-3 text-sm text-graphite">
      <span className="flex items-center gap-2">
        <WarningCircleIcon size={16} weight="bold" className="shrink-0 text-climateOrange" />
        {label}
      </span>
      <Badge tone="warning" className="shrink-0 whitespace-nowrap">{t('Thiếu dữ liệu')}</Badge>
    </div>
  )
}

// Một mục của danh sách ngắn: tiêu đề bên trái, giờ bên phải
function AlertLines({ title, items, empty }: { title: string; items?: Array<{ _id: string; title: string; created_at: string }> | null; empty: string }) {
  return (
    <div className="rounded-2xl border border-warmGray/15 p-3.5 text-xs">
      <p className="mb-1.5 text-sm font-semibold text-charcoal">{title}</p>
      {items && items.length > 0 ? (
        <ul className="space-y-1">
          {items.map(item => (
            <li key={item._id} className="flex justify-between gap-2 text-warmGray">
              <span className="truncate">{item.title}</span>
              <span className="shrink-0">{formatDate(item.created_at)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-warmGray">{empty}</p>}
    </div>
  )
}

export default function MultimodalEvidenceCharts({ alert }: Props) {
  const { data: evidence, isLoading } = useAlertEvidence(alert._id)
  const [showAllVerdicts, setShowAllVerdicts] = useState(false)

  // Chuyển dữ liệu thật từ GET /alerts/{id}/evidence thành cấu hình biểu đồ
  const cfg = useMemo(() => buildAlertEvidence(alert, evidence), [alert, evidence])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <LoadingSkeleton count={2} className="h-28 w-full rounded-xl" />
        <LoadingSkeleton count={1} className="h-16 w-full rounded-xl" />
      </div>
    )
  }

  const isLowReturn = alert.type === 'LOW_RETURN_RATE'
  const telemetryMissing = evidence?.telemetry?.status === 'missing' || !cfg.src1
  const birdCountsMissing = evidence?.bird_counts?.status === 'missing' || !cfg.src2
  const earlier = evidence?.earlier_verdicts ?? []
  const shownVerdicts = showAllVerdicts ? earlier : earlier.slice(0, VISIBLE_VERDICTS)

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        {/* Khung giờ chỉ ghi một lần, ở đầu phần số liệu */}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-charcoal">{t('Số liệu quanh lúc cảnh báo')}</h3>
          {!isLowReturn && <span className="text-xs text-warmGray">{cfg.windowLabel}</span>}
        </div>

        {isLowReturn ? (
          <>
            <div className="rounded-2xl border border-warmGray/15 p-4">
              <h4 className="mb-2 text-sm font-semibold text-charcoal">{t('Tỷ lệ thời gian trong ngưỡng của từng Zone hôm nay')}</h4>
              {evidence?.zones_in_range && evidence.zones_in_range.length > 0 ? (
                <div className="divide-y divide-warmGray/10">
                  {evidence.zones_in_range.map(zoneItem => (
                    <div key={zoneItem.zone_id} className="flex items-center justify-between py-2 text-xs">
                      <span className="font-medium text-charcoal">{zoneItem.name}</span>
                      {zoneItem.status === 'missing' ? (
                        <Badge tone="neutral">{t('Thiếu dữ liệu')}</Badge>
                      ) : (
                        <span className="text-warmGray">
                          {t('Nhiệt độ:')} <b className="text-charcoal">{zoneItem.temp_in_range_pct ?? '—'}%</b>
                          {' · '}
                          {t('Độ ẩm:')} <b className="text-charcoal">{zoneItem.humidity_in_range_pct ?? '—'}%</b>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-warmGray">{t('Không có dữ liệu Zone trong ngày')}</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AlertLines title={t('Cảnh báo tiếng ồn trong ngày')} items={evidence?.noise_alerts} empty={t('Không có sự cố tiếng ồn')} />
              <AlertLines title={t('Cảnh báo thiết bị trong ngày')} items={evidence?.device_alerts} empty={t('Thiết bị vận hành ổn định')} />
            </div>
          </>
        ) : (
          <>
            {telemetryMissing || !cfg.src1
              ? <MissingNote label={t('Không có số đo cảm biến trong ±30 phút quanh cảnh báo')} />
              : <EvidenceBarCard src={cfg.src1} />}
            {birdCountsMissing || !cfg.src2
              ? <MissingNote label={t('Không có số đếm chim trong ±30 phút quanh cảnh báo')} />
              : <EvidenceBarCard src={cfg.src2} />}

            {/* Thiết bị đang có cảnh báo mở tại Zone */}
            {evidence?.device_alerts && evidence.device_alerts.length > 0 && (
              <div className="rounded-2xl border border-alertRed/30 bg-alertRed/5 p-3.5 text-xs text-charcoal">
                <p className="mb-1 text-sm font-semibold text-alertRed">{t('Thiết bị đang có cảnh báo mở tại Zone này:')}</p>
                <ul className="list-inside list-disc space-y-0.5 text-warmGray">
                  {evidence.device_alerts.map(deviceAlert => (
                    <li key={deviceAlert._id}><span className="font-medium text-charcoal">{deviceAlert.title}</span>: {deviceAlert.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* Kết quả kiểm tra tại chỗ của Kỹ thuật viên */}
      {evidence?.onsite_checks && evidence.onsite_checks.length > 0 && <OnsiteCheckSection checks={evidence.onsite_checks} />}

      {/* Các kết luận cũ cùng loại tại Zone: 3 mới nhất hiện sẵn */}
      <section>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-charcoal">{t('Kết luận trước đây cùng loại tại Zone')}</h3>
          <span className="text-xs text-warmGray">{t('{{n}}/10 kết luận gần nhất', { n: earlier.length })}</span>
        </div>
        {earlier.length > 0 ? (
          <>
            <ul className="divide-y divide-warmGray/10">
              {shownVerdicts.map(item => {
                const verdict = item.expert_verdict
                const isConfirmed = verdict?.result === 'CONFIRMED'
                const authorName = typeof verdict?.by === 'object' ? verdict.by?.full_name : t('Chuyên gia')
                const authorRole = verdict?.role === 'FARM_OWNER' ? t('Chủ nhà yến') : t('Chuyên gia')
                return (
                  <li key={item._id} className="flex items-start gap-3 py-2.5">
                    <Badge tone={isConfirmed ? 'critical' : 'neutral'} className="shrink-0">{isConfirmed ? t('Đã xác nhận') : t('Đã bác bỏ')}</Badge>
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="text-charcoal">
                        <span className="font-semibold">{authorName}</span>
                        <span className="text-warmGray"> ({authorRole}) · {verdict?.at ? formatDate(verdict.at) : formatDate(item.created_at)}</span>
                      </p>
                      {verdict?.note && <p className="mt-0.5 text-warmGray">"{verdict.note}"</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
            {earlier.length > VISIBLE_VERDICTS && (
              <button type="button" onClick={() => setShowAllVerdicts(current => !current)} className="mt-1 text-xs font-semibold text-charcoal underline-offset-2 hover:underline">
                {showAllVerdicts ? t('Thu gọn') : t('Xem thêm {{n}} kết luận', { n: earlier.length - VISIBLE_VERDICTS })}
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-warmGray">{t('Zone chưa có kết luận nào cho loại cảnh báo này; kết luận của bạn sẽ được lưu lại.')}</p>
        )}
      </section>
    </div>
  )
}
