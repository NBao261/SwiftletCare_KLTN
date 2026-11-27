// Ngăn kéo kiểm chứng cảnh báo, render qua createPortal để nằm trên layout và banner
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import type { InferredAlertItem } from '@/types/expert.types'
import { ALERT_TYPE_LABELS, useSubmitAlertVerdict } from '@/hooks/domain-expert/useExpertAlerts'
import { useZone } from '@/hooks/shared/useFarms'
import { useZoneStore } from '@/stores/zoneStore'
import MultimodalEvidenceCharts from './MultimodalEvidenceCharts'
import VerdictForm from './VerdictForm'
import SeverityBadge from '@/components/common/SeverityBadge'
import { Badge, Button, type BadgeTone } from '@/components/ui'
import { useRemindExpert } from '@/hooks/shared/useRemindExpert'
import { useExpertDecisionRights } from '@/hooks/domain-expert/useExpertDecisionRights'
import { t } from '@/i18n'

interface Props {
  alert: InferredAlertItem | null
  isOpen: boolean
  onClose: () => void
  onVerdictSaved?: (alertId: string, result: 'CONFIRMED' | 'REJECTED') => void
}

// Kết luận hiện tại của chuyên gia: chờ, xác nhận hoặc bác bỏ
function verdictBadge(alert?: InferredAlertItem | null): { label: string; tone: BadgeTone } {
  const verdict = alert?.expert_verdict
  if (alert?.status === 'DISMISSED' || verdict?.result === 'REJECTED') return { label: 'Đã bác bỏ', tone: 'neutral' }
  if (verdict?.result === 'CONFIRMED') return { label: 'Đã xác nhận', tone: 'critical' }
  return { label: 'Chờ kiểm chứng', tone: 'warning' }
}

const pad = (value: number) => value.toString().padStart(2, '0')

export default function ExpertVerdictDrawer({ alert, isOpen, onClose, onVerdictSaved }: Props) {
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

  const canSave = Boolean(verdict) && !mutation.isPending && (verdict !== 'REJECTED' || note.trim() !== '')

  const handleSave = async () => {
    if (!alert || !verdict) return
    await mutation.mutateAsync({ alertId: alert._id, result: verdict, note: note.trim() || undefined })
    onVerdictSaved?.(alert._id, verdict)
    onClose()
  }

  const alertDate = alert ? new Date(alert.created_at) : null
  const dateLabel = alertDate && !Number.isNaN(alertDate.getTime())
    ? `${pad(alertDate.getHours())}:${pad(alertDate.getMinutes())} · ${alertDate.getDate()}/${alertDate.getMonth() + 1}/${alertDate.getFullYear()}`
    : ''

  const zoneLabel = useMemo(() => {
    if (!alert?.zone_id) return null
    if (zone?.floor && zone?.name) return zone.name.toLowerCase().includes('tầng') ? zone.name : `${t('Tầng {{n}}', { n: zone.floor })} · ${zone.name}`
    if (zone?.name) return zone.name
    if (selectedZoneId === alert.zone_id && selectedZoneName) return selectedZoneName.replace(/\s*-\s*/g, ' · ')
    return t('Zone')
  }, [alert?.zone_id, zone, selectedZoneId, selectedZoneName])

  if (typeof document === 'undefined') return null

  const status = verdictBadge(alert)
  const meta = [dateLabel, zoneLabel, (alert?.occurrence_count ?? 1) > 1 ? t('{{n}} lần', { n: alert?.occurrence_count }) : null].filter(Boolean)

  return createPortal(
    <>
      <div onClick={onClose} className={cn('fixed inset-0 z-40 transition-all duration-300',
        isOpen ? 'pointer-events-auto bg-charcoal/30 backdrop-blur-[2px]' : 'pointer-events-none bg-transparent')} />

      <aside className={cn('fixed right-0 top-0 z-50 flex h-full w-full max-w-[620px] flex-col border-l border-warmGray/15 bg-white shadow-2xl',
        'transition-transform duration-300 ease-in-out', isOpen ? 'translate-x-0' : 'translate-x-full')}>
        {/* Đầu ngăn kéo: loại cảnh báo, kết luận hiện tại, thời gian · Zone · số lần, câu bằng chứng của hệ thống */}
        <div className="flex items-start justify-between gap-4 border-b border-warmGray/10 px-6 pb-4 pt-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-h2 text-charcoal">{alert ? (ALERT_TYPE_LABELS[alert.type] ?? alert.type) : ''}</h2>
              {alert && <SeverityBadge severity={alert.severity} />}
              <Badge tone={status.tone}>{t(status.label)}</Badge>
            </div>
            {meta.length > 0 && <p className="mt-1 text-small text-warmGray">{meta.join(' · ')}</p>}
            {alert?.message && <p className="mt-2 text-sm text-charcoal">{alert.message}</p>}
          </div>
          <Button variant="icon" size="sm" onClick={onClose} aria-label={t('Đóng')}>
            <XIcon size={16} weight="bold" />
          </Button>
        </div>

        {/* Bằng chứng: phần cuộn */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {alert && <MultimodalEvidenceCharts alert={alert} />}
        </div>

        {/* Kết luận luôn nằm dưới đáy, không phải cuộn mới thấy */}
        <div className="flex flex-col gap-3 border-t border-warmGray/15 bg-white px-6 py-4">
          {canDecide ? (
            <>
              <VerdictForm alert={alert} verdict={verdict} note={note} onVerdictChange={setVerdict} onNoteChange={setNote} />
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={!canSave} loading={mutation.isPending}>
                  {mutation.isPending ? t('Đang lưu...') : t('Lưu kết luận')}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-warmGray">{t('Trang trại đã có chuyên gia nên kết luận do chuyên gia ghi. Bạn xem được bằng chứng.')}</p>
              {canRemind && remindControl}
            </div>
          )}
        </div>
      </aside>
    </>,
    document.body,
  )
}
