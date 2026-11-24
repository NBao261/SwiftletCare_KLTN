// Ngăn kéo thẩm định cảnh báo, render qua createPortal để nằm trên layout và banner
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { InferredAlertItem } from '@/types/expert.types'
import { ALERT_TYPE_LABELS, useSubmitAlertVerdict } from '@/hooks/domain-expert/useExpertAlerts'
import { useZone } from '@/hooks/shared/useFarms'
import { useZoneStore } from '@/stores/zoneStore'
import MultimodalEvidenceCharts from './MultimodalEvidenceCharts'
import VerdictForm from './VerdictForm'
import { Button } from '@/components/ui/Button'
import { useRemindExpert } from '@/hooks/shared/useRemindExpert'
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights'
import { t } from '@/i18n'

interface Props {
  alert: InferredAlertItem | null
  isOpen: boolean
  onClose: () => void
  onVerdictSaved?: (alertId: string, result: 'CONFIRMED' | 'REJECTED') => void
}

function StatusBadge({ alert }: { alert?: InferredAlertItem | null }) {
  const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold'
  const verdict = alert?.expert_verdict
  if (alert?.status === 'DISMISSED' || verdict?.result === 'REJECTED') {
    return <span className={cn(base, 'bg-neutral-100 text-[#878380] border border-neutral-300')}>{t('Đã bác bỏ')}</span>
  }
  if (!verdict) return <span className={cn(base, 'bg-amber-50 text-amber-800 border border-amber-200/80')}>{t('Chờ kiểm chứng')}</span>
  return verdict.result === 'CONFIRMED'
    ? <span className={cn(base, 'bg-red-50 text-red-600 border border-red-200')}>{t('Đã xác nhận')}</span>
    : <span className={cn(base, 'bg-neutral-100 text-[#878380] border border-neutral-200')}>{t('Đã bác bỏ')}</span>
}

export default function ExpertVerdictDrawer({ alert, isOpen, onClose, onVerdictSaved }: Props) {
  const navigate = useNavigate()
  const [verdict, setVerdict] = useState<'CONFIRMED' | 'REJECTED' | null>(null)
  const [note, setNote] = useState('')
  const mutation = useSubmitAlertVerdict()
  // Farm Owner kết luận thay khi farm chưa có chuyên gia; farm có chuyên gia thì xem bằng chứng và nhắc chuyên gia
  const { canDecide, ownerNeedsExpert } = useExpertDecisionRights()
  const reminder = useRemindExpert('alert', alert?._id, alert?.expert_reminded_at)
  // Farm Owner ở farm có chuyên gia, cảnh báo chưa có kết luận: nhắc chuyên gia (mỗi cảnh báo một lần)
  const canRemind = ownerNeedsExpert && !alert?.expert_verdict
  const remindControl = reminder.reminded
    ? <span className="text-small text-warmGray">{t('Đã nhắc chuyên gia')}</span>
    : <Button variant="secondary" size="sm" loading={reminder.isPending} onClick={reminder.remind}>{t('Nhắc chuyên gia')}</Button>
  const { data: zone } = useZone(alert?.zone_id)
  const { selectedZoneId, selectedZoneName } = useZoneStore()

  // Theo giá trị kết luận, không theo object: trang đọc lại danh sách thì ghi chú đang gõ không mất
  const alertId = alert?._id
  const savedResult = alert?.expert_verdict?.result ?? null
  const savedNote = alert?.expert_verdict?.note ?? ''
  useEffect(() => {
    if (isOpen && alertId) {
      setVerdict(savedResult)
      setNote(savedNote)
    }
  }, [isOpen, alertId, savedResult, savedNote])

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
  const windowLabel = t('Khung giờ ±30 phút ({{from}} – {{to}})', { from: `${pad(tStart.getHours())}:${pad(tStart.getMinutes())}`, to: `${pad(tEnd.getHours())}:${pad(tEnd.getMinutes())}` })
  const dateLabel = alertDate ? `${pad(alertDate.getHours())}:${pad(alertDate.getMinutes())} · ${alertDate.getDate()}/${alertDate.getMonth() + 1}/${alertDate.getFullYear()}` : ''

  const zoneLabel = useMemo(() => {
    if (!alert?.zone_id) return null
    if (zone?.floor && zone?.name) return zone.name.toLowerCase().includes('tầng') ? zone.name : `${t('Tầng {{n}}', { n: zone.floor })} • ${zone.name}`
    if (zone?.name) return zone.name
    if (selectedZoneId === alert.zone_id && selectedZoneName) return selectedZoneName.replace(/\s*-\s*/g, ' • ')
    return t('Zone')
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
              <h2 className="text-lg font-bold text-[#27231F] leading-tight">{t('Cảnh báo {{type}}', { type: alert ? ALERT_TYPE_LABELS[alert.type] : '' })}</h2>
              <StatusBadge alert={alert} />
            </div>
            <p className="mt-1 text-xs text-[#878380] leading-relaxed">
              {dateLabel}{zoneLabel && <> &nbsp;•&nbsp; {zoneLabel}</>}
              {alert?.occurrence_count && <> &nbsp;•&nbsp; {t('Số lần lặp:')} <b className="text-[#27231F]">{t('{{n}} lần', { n: alert.occurrence_count })}</b></>}
            </p>
          </div>
          <button onClick={onClose} aria-label={t('Đóng ngăn kéo')}
            className="text-[#878380] hover:text-[#27231F] transition-colors p-1 rounded-lg hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#27231F]">{t('Bước 1: Số liệu quanh cảnh báo (±30 phút)')}</h3>
              <span className="text-xs text-[#878380]">{windowLabel}</span>
            </div>
            {alert && <MultimodalEvidenceCharts alert={alert} />}
          </section>
          <section>
            <h3 className="text-sm font-semibold text-[#27231F] mb-3">{t('Bước 2: Kết luận của chuyên gia')}</h3>
            {canDecide
              ? <VerdictForm alert={alert} verdict={verdict} note={note} onVerdictChange={setVerdict} onNoteChange={setNote} />
              : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-warmGray">{t('Trang trại đã có chuyên gia nên kết luận do chuyên gia ghi. Bạn xem được bằng chứng.')}</p>
                  {canRemind && remindControl}
                </div>
              )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-100 flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-[#27231F] hover:bg-neutral-50 transition-colors">
              {t('Huỷ')}
            </button>
            <button
              type="button"
              onClick={() => { onClose(); navigate('/domain-expert/tuning') }}
              className="text-xs text-[#878380] hover:text-[#27231F] hover:underline font-medium px-2 py-1.5 transition-colors cursor-pointer"
            >
              {t('Chỉnh độ nhạy phát hiện →')}
            </button>
          </div>
          {canDecide && <button
            type="button"
            disabled={!verdict || mutation.isPending || (verdict === 'REJECTED' && !note.trim())}
            onClick={handleSave}
            className={cn('inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
              verdict && !mutation.isPending && (verdict !== 'REJECTED' || note.trim())
                ? 'bg-[#27231F] text-white hover:bg-[#3D3630] shadow-md'
                : 'bg-neutral-200 text-neutral-400 cursor-not-allowed')}
          >
            {mutation.isPending ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('Đang lưu...')}</> : t('Lưu kết luận')}
          </button>}
        </div>
      </aside>
    </>,
    document.body,
  )
}
