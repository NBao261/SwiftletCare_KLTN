import { InfoIcon, ShieldWarningIcon } from '@phosphor-icons/react'
import FieldError from '@/components/ui/FieldError'
import { cn } from '@/lib/cn'
import type { InferredAlertItem } from '@/types/expert.types'
import { formatDate } from '@/lib/helpers'
import { t } from '@/i18n'

const MAX_NOTE = 1000

interface Props {
  alert?: InferredAlertItem | null
  verdict: 'CONFIRMED' | 'REJECTED' | null
  note: string
  onVerdictChange: (v: 'CONFIRMED' | 'REJECTED') => void
  onNoteChange: (n: string) => void
}

// Hai lựa chọn kết luận: nút chọn một, có chữ gợi ý ngắn bên dưới
function ChoiceButton({ value, selected, onClick, title, hint }: {
  value: 'CONFIRMED' | 'REJECTED'
  selected: boolean
  onClick: () => void
  title: string
  hint: string
}) {
  const isConfirmed = value === 'CONFIRMED'
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
        selected && isConfirmed && 'border-alertRed bg-alertRed/10',
        selected && !isConfirmed && 'border-charcoal bg-warmGray/10',
        !selected && 'border-warmGray/20 bg-white hover:border-charcoal/40',
      )}
    >
      <span className="text-sm font-semibold text-charcoal">{title}</span>
      <span className="text-xs text-warmGray">{hint}</span>
    </button>
  )
}

// Kết luận của chuyên gia: chọn sự cố thật hay báo động giả, ghi chú (bắt buộc khi bác bỏ)
export default function VerdictForm({ alert, verdict, note, onVerdictChange, onNoteChange }: Props) {
  const existingVerdict = alert?.expert_verdict
  const isDismissed = alert?.status === 'DISMISSED' || existingVerdict?.result === 'REJECTED'
  const authorName = typeof existingVerdict?.by === 'object' ? existingVerdict.by?.full_name : t('Chuyên gia')
  const authorRole = existingVerdict?.role === 'FARM_OWNER' ? t('Chủ nhà yến (làm thay chuyên gia)') : t('Chuyên gia')
  const previousStatusLabel = alert?.previous_status === 'ACKNOWLEDGED' ? t('Chủ nhà yến đã nhận') : t('Đang mở')
  const isNoteMissing = verdict === 'REJECTED' && !note.trim()

  return (
    <div className="flex flex-col gap-3">
      {/* Cảnh báo đã bị bác bỏ: một dòng ai bác bỏ và khi nào; lý do nằm sẵn trong ô ghi chú bên dưới */}
      {isDismissed && (
        <p className="flex items-start gap-2 rounded-xl bg-warmGray/10 px-3 py-2 text-small text-graphite">
          <ShieldWarningIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-warmGray" />
          <span>
            {t('Đã bác bỏ bởi {{name}} ({{role}}) lúc {{time}}', { name: authorName ?? '', role: authorRole, time: existingVerdict?.at ? formatDate(existingVerdict.at) : '—' })}
          </span>
        </p>
      )}

      {/* Đổi sang xác nhận thì cảnh báo trở lại trạng thái cũ */}
      {isDismissed && verdict === 'CONFIRMED' && (
        <p className="flex items-start gap-2 rounded-xl border border-infoBlue/20 bg-infoBlue/5 px-3 py-2 text-small text-graphite">
          <InfoIcon size={16} weight="bold" className="mt-0.5 shrink-0 text-infoBlue" />
          <span>{t('Xác nhận sẽ khôi phục cảnh báo về trạng thái "{{status}}" và gửi lại thông báo cho chủ nhà yến.', { status: previousStatusLabel })}</span>
        </p>
      )}

      <div role="radiogroup" aria-label={t('Kết luận của chuyên gia')} className="grid grid-cols-2 gap-2.5">
        <ChoiceButton
          value="CONFIRMED" selected={verdict === 'CONFIRMED'} onClick={() => onVerdictChange('CONFIRMED')}
          title={t('Xác nhận sự cố thật')} hint={t('Ảnh hưởng đàn chim hoặc vi khí hậu')}
        />
        <ChoiceButton
          value="REJECTED" selected={verdict === 'REJECTED'} onClick={() => onVerdictChange('REJECTED')}
          title={t('Bác bỏ: báo động giả')} hint={t('Nhiễu cảm biến hoặc dao động tự nhiên')}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label className="text-sm font-semibold text-charcoal" htmlFor="expert-note">{t('Ghi chú chuyên môn')}</label>
          {isNoteMissing
            ? <FieldError inline>{t('Bắt buộc nhập lý do bác bỏ')}</FieldError>
            : <span className="text-xs text-warmGray">{t('{{n}}/{{max}} ký tự', { n: note.length, max: MAX_NOTE })}</span>}
        </div>
        <textarea
          id="expert-note"
          rows={2}
          maxLength={MAX_NOTE}
          placeholder={verdict === 'REJECTED'
            ? t('Nhập rõ lý do vì sao đây là báo động giả (bắt buộc)...')
            : t('Nhập nhận xét kỹ thuật, bằng chứng thêm hoặc hướng xử lý...')}
          value={note}
          onChange={event => onNoteChange(event.target.value)}
          className="w-full resize-none rounded-xl border border-warmGray/20 bg-warmGray/5 px-3.5 py-2.5 text-sm text-charcoal placeholder:text-warmGray/70 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent-600"
        />
      </div>
    </div>
  )
}
