/**
 * 02B_Expert_Verdict_Drawer_v3 — Ngăn kéo Thẩm định Cảnh báo (Orchestrator)
 * Slide-over từ phải, render qua createPortal ở z-50 trên toàn bộ layout và banner
 * SRS v2.1.4: EXPERT-FR-003
 */
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { InferredAlertItem } from '@/types/expert.types'
import { ALERT_TYPE_LABELS, useSubmitAlertVerdict } from '@/hooks/expert/useExpertAlerts'
import { useZone } from '@/hooks/shared/useFarms'
import { useZoneStore } from '@/stores/zoneStore'
import MultimodalEvidenceCharts from './MultimodalEvidenceCharts'
import VerdictForm from './VerdictForm'

interface Props {
  alert: InferredAlertItem | null
  isOpen: boolean
  onClose: () => void
  onVerdictSaved?: (alertId: string, result: 'CONFIRMED' | 'REJECTED') => void
}

function StatusBadge({ verdict }: { verdict?: InferredAlertItem['expert_verdict'] }) {
  const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold'
  if (!verdict) return <span className={cn(base, 'bg-amber-50 text-amber-800 border border-amber-200/80')}>Chờ kiểm chứng</span>
  return verdict.result === 'CONFIRMED'
    ? <span className={cn(base, 'bg-red-50 text-red-600 border border-red-200')}>Đã xác nhận</span>
    : <span className={cn(base, 'bg-neutral-100 text-[#878380] border border-neutral-200')}>Đã bác bỏ</span>
}

function renderActuatorStatus(type?: string) {
  if (type === 'NOISE_ANOMALY') return <>Loa dẫn dụ: <b className="text-[#27231F]">Đang tắt</b></>
  if (type === 'SENSOR_ANOMALY') return <>Phun sương: <b className="text-[#27231F]">Đang tắt (0%)</b></>
  if (type === 'PUMP_DRY') return <>Bơm cấp ẩm: <b className="text-red-600">Sụt tải (chạy khô)</b></>
  if (type === 'FORECAST_BREACH') return <>Phun sương đón đầu: <b className="text-[#27231F]">Sẵn sàng</b></>
  if (type === 'LOW_RETURN_RATE') return <>Cửa thu chim: <b className="text-[#27231F]">Đang mở</b></>
  return <>Thiết bị: <b className="text-[#27231F]">Ổn định</b></>
}

export default function ExpertVerdictDrawer({ alert, isOpen, onClose, onVerdictSaved }: Props) {
  const navigate = useNavigate()
  const [verdict, setVerdict] = useState<'CONFIRMED' | 'REJECTED' | null>(null)
  const [note, setNote] = useState('')
  const mutation = useSubmitAlertVerdict()
  const { data: zone } = useZone(alert?.zone_id)
  const { selectedZoneId, selectedZoneName } = useZoneStore()

  useEffect(() => {
    if (isOpen && alert) {
      setVerdict(alert.expert_verdict?.result ?? null)
      setNote(alert.expert_verdict?.note ?? '')
    }
  }, [isOpen, alert])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleSave = async () => {
    if (!alert || !verdict) return
    await mutation.mutateAsync({ alertId: alert._id, result: verdict, note: note.trim() || undefined })
    onVerdictSaved?.(alert._id, verdict)
    onClose()
  }

  const alertDate = alert ? new Date(alert.created_at) : null
  const baseDate = alertDate && !isNaN(alertDate.getTime()) ? alertDate : new Date()
  const tStart = new Date(baseDate.getTime() - 30 * 60_000), tEnd = new Date(baseDate.getTime() + 30 * 60_000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  const windowLabel = `Khung giờ ±30 phút (${pad(tStart.getHours())}:${pad(tStart.getMinutes())} – ${pad(tEnd.getHours())}:${pad(tEnd.getMinutes())})`
  const dateLabel = alertDate ? `${pad(alertDate.getHours())}:${pad(alertDate.getMinutes())} — ${alertDate.getDate()}/${alertDate.getMonth() + 1}/${alertDate.getFullYear()}` : ''

  const zoneLabel = useMemo(() => {
    if (!alert?.zone_id) return null
    if (zone?.floor && zone?.name) return zone.name.toLowerCase().includes('tầng') ? zone.name : `Tầng ${zone.floor} • ${zone.name}`
    if (zone?.name) return zone.name
    if (selectedZoneId === alert.zone_id && selectedZoneName) return selectedZoneName.replace(/\s*-\s*/g, ' • ')
    return 'Khu vực nuôi yến'
  }, [alert?.zone_id, zone, selectedZoneId, selectedZoneName])

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div onClick={onClose} className={cn('fixed inset-0 z-40 transition-all duration-300',
        isOpen ? 'bg-black/30 backdrop-blur-[2px] pointer-events-auto' : 'bg-transparent pointer-events-none')} />

      <aside className={cn('fixed top-0 right-0 z-50 h-full w-full max-w-[620px] bg-white shadow-2xl flex flex-col',
        'transition-transform duration-300 ease-in-out border-l border-neutral-200', isOpen ? 'translate-x-0' : 'translate-x-full')}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-neutral-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-[#27231F] leading-tight">Cảnh báo {alert ? ALERT_TYPE_LABELS[alert.type] : ''}</h2>
              <StatusBadge verdict={alert?.expert_verdict} />
            </div>
            <p className="mt-1 text-xs text-[#878380] leading-relaxed">
              {dateLabel}{zoneLabel && <> &nbsp;•&nbsp; {zoneLabel}</>}
              {alert?.occurrence_count && <> &nbsp;•&nbsp; Số lần lặp: <b className="text-[#27231F]">{alert.occurrence_count} lần</b></>}
              &nbsp;•&nbsp; {renderActuatorStatus(alert?.type)}
            </p>
          </div>
          <button onClick={onClose} aria-label="Đóng ngăn kéo"
            className="text-[#878380] hover:text-[#27231F] transition-colors p-1 rounded-lg hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#27231F]">Bước 1 — Bằng chứng đối chiếu đa phương thức</h3>
              <span className="text-xs text-[#878380]">{windowLabel}</span>
            </div>
            {alert && <MultimodalEvidenceCharts alert={alert} />}
          </section>
          <section>
            <h3 className="text-sm font-semibold text-[#27231F] mb-3">Bước 2 — Phán quyết của Chuyên gia</h3>
            <VerdictForm verdict={verdict} note={note} onVerdictChange={setVerdict} onNoteChange={setNote} />
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-100 flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-[#27231F] hover:bg-neutral-50 transition-colors">
              Huỷ
            </button>
            <button
              type="button"
              onClick={() => { onClose(); navigate('/expert/tuning') }}
              className="text-xs text-[#878380] hover:text-[#27231F] hover:underline font-medium px-2 py-1.5 transition-colors cursor-pointer"
            >
              Chỉnh độ nhạy phát hiện →
            </button>
          </div>
          <button type="button" disabled={!verdict || mutation.isPending} onClick={handleSave}
            className={cn('inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
              verdict && !mutation.isPending ? 'bg-[#27231F] text-white hover:bg-[#3D3630] shadow-md' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed')}>
            {mutation.isPending ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Đang lưu...</> : 'Lưu phán quyết'}
          </button>
        </div>
      </aside>
    </>,
    document.body,
  )
}
