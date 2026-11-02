import { Info, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { InferredAlertItem } from '@/types/expert.types'
import { formatDate } from '@/lib/helpers'

const MAX_NOTE = 1000

interface Props {
  alert?: InferredAlertItem | null
  verdict: 'CONFIRMED' | 'REJECTED' | null
  note: string
  onVerdictChange: (v: 'CONFIRMED' | 'REJECTED') => void
  onNoteChange: (n: string) => void
}

function RadioCard({
  value, selected, onClick, title, badge, subtitle,
}: {
  value: 'CONFIRMED' | 'REJECTED'
  selected: boolean
  onClick: () => void
  title: string
  badge: string
  subtitle: string
}) {
  const isConfirmed = value === 'CONFIRMED'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-col gap-1 p-4 rounded-xl border-2 text-left transition-all duration-150 cursor-pointer',
        selected && isConfirmed ? 'border-red-400 bg-red-50 shadow-sm' : '',
        selected && !isConfirmed ? 'border-neutral-400 bg-neutral-50 shadow-sm' : '',
        !selected ? 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50' : '',
      )}
    >
      <span className={cn(
        'absolute top-3 right-3 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
        selected && isConfirmed ? 'border-red-500 bg-red-500' : '',
        selected && !isConfirmed ? 'border-neutral-600 bg-neutral-600' : '',
        !selected ? 'border-neutral-300' : '',
      )}>
        {selected && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
      </span>
      <span className="text-sm font-semibold text-[#27231F] pr-6">{title}</span>
      <span className={cn('text-xs font-medium', isConfirmed ? 'text-red-600' : 'text-neutral-500')}>
        ({badge})
      </span>
      <span className="text-xs text-[#878380] mt-0.5">{subtitle}</span>
    </button>
  )
}

export default function VerdictForm({ alert, verdict, note, onVerdictChange, onNoteChange }: Props) {
  const existingVerdict = alert?.expert_verdict
  const isDismissed = alert?.status === 'DISMISSED' || existingVerdict?.result === 'REJECTED'
  const authorName = typeof existingVerdict?.by === 'object' ? existingVerdict.by?.full_name : 'Chuyên gia'
  const authorRole = existingVerdict?.role === 'FARM_OWNER' ? 'Chủ nhà yến (làm thay BR-22)' : 'Chuyên gia'

  const previousStatusLabel =
    alert?.previous_status === 'ACKNOWLEDGED'
      ? 'Chủ nhà đã nhận (ACKNOWLEDGED)'
      : 'Đang mở (ACTIVE)'

  return (
    <div className="space-y-4">
      {/* Thông tin bác bỏ hiện tại nếu cảnh báo đang DISMISSED */}
      {isDismissed && (
        <div className="rounded-xl border border-neutral-300 bg-neutral-50/80 p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-neutral-800 font-semibold">
            <ShieldAlert className="w-4 h-4 text-warmGray" />
            <span>Cảnh báo đã bị Bác bỏ (DISMISSED)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-warmGray text-[11.5px] pl-6">
            <div>
              <span className="text-neutral-500">Người bác bỏ:</span>{' '}
              <strong className="text-charcoal">{authorName}</strong> ({authorRole})
            </div>
            <div>
              <span className="text-neutral-500">Thời điểm:</span>{' '}
              <strong className="text-charcoal">{existingVerdict?.at ? formatDate(existingVerdict.at) : '—'}</strong>
            </div>
            <div className="sm:col-span-2">
              <span className="text-neutral-500">Trạng thái trước khi bác bỏ:</span>{' '}
              <span className="font-semibold text-charcoal">{previousStatusLabel}</span>
            </div>
            {existingVerdict?.note && (
              <div className="sm:col-span-2 bg-white p-2.5 rounded-lg border border-neutral-200">
                <span className="text-neutral-500 block mb-0.5 font-medium">Lý do bác bỏ:</span>
                <p className="text-charcoal italic leading-relaxed">"{existingVerdict.note}"</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Thông báo khôi phục trạng thái khi đổi sang CONFIRMED */}
      {isDismissed && verdict === 'CONFIRMED' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 flex gap-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Khôi phục trạng thái:</strong> Đổi sang <em>Xác nhận sự cố thật</em> sẽ khôi phục cảnh báo về trạng thái{' '}
            <strong>{previousStatusLabel}</strong> và gửi lại thông báo cho Chủ nhà yến.
          </p>
        </div>
      )}

      {/* Radio cards */}
      <div className="grid grid-cols-2 gap-3">
        <RadioCard
          value="CONFIRMED" selected={verdict === 'CONFIRMED'}
          onClick={() => onVerdictChange('CONFIRMED')}
          title="Xác nhận sự cố thật" badge="CONFIRMED"
          subtitle="Sự cố thực tế gây ảnh hưởng đến đàn chim hoặc vi khí hậu"
        />
        <RadioCard
          value="REJECTED" selected={verdict === 'REJECTED'}
          onClick={() => onVerdictChange('REJECTED')}
          title="Bác bỏ - Báo động giả" badge="REJECTED"
          subtitle="Nhiễu cảm biến hoặc dao động tự nhiên của môi trường (chuyển sang DISMISSED)"
        />
      </div>

      {/* Ghi chú chuyên môn */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-[#27231F]" htmlFor="expert-note">
            Ghi chú chuyên môn
          </label>
          {verdict === 'REJECTED' && (
            <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              Bắt buộc nhập lý do bác bỏ
            </span>
          )}
        </div>
        <textarea
          id="expert-note"
          rows={4}
          maxLength={MAX_NOTE}
          placeholder={verdict === 'REJECTED'
            ? 'Nhập rõ lý do vì sao nhận định đây là báo động giả (bắt buộc theo quy chuẩn G-03)...'
            : 'Nhập nhận xét kỹ thuật, bằng chứng thêm hoặc hướng xử lý...'}
          value={note}
          onChange={e => onNoteChange(e.target.value)}
          className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-[#27231F] placeholder-[#B8B4B0] focus:outline-none focus:ring-2 focus:ring-[#B5D32C] focus:border-transparent transition-all"
        />
        <div className="flex items-start justify-between mt-1.5 gap-2">
          <p className="text-[11px] text-[#878380] italic leading-relaxed flex-1">
            Lưu ý: Bác bỏ cảnh báo sẽ chuyển trạng thái sang DISMISSED và lưu lại lý do. Xác nhận lại sẽ khôi phục trạng thái ban đầu.
          </p>
          <span className="text-xs text-[#878380] flex-shrink-0 font-mono">
            {note.length}/{MAX_NOTE} ký tự
          </span>
        </div>
      </div>
    </div>
  )
}
