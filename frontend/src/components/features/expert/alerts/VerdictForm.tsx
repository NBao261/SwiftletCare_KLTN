/**
 * VerdictForm — Form phán quyết chuyên gia (Bước 2 Drawer 02B)
 * Radio CONFIRMED/REJECTED + Textarea ghi chú + bộ đếm ký tự
 * SRS v2.1.4: EXPERT-FR-003
 */
import { cn } from '@/lib/cn'

const MAX_NOTE = 1000

interface Props {
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
        'relative flex flex-col gap-1 p-4 rounded-xl border-2 text-left transition-all duration-150',
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

export default function VerdictForm({ verdict, note, onVerdictChange, onNoteChange }: Props) {
  return (
    <div className="space-y-4">
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
          subtitle="Nhiễu cảm biến hoặc dao động tự nhiên của môi trường"
        />
      </div>

      {/* Ghi chú chuyên môn */}
      <div>
        <label className="block text-sm font-semibold text-[#27231F] mb-2" htmlFor="expert-note">
          Ghi chú chuyên môn
        </label>
        <textarea
          id="expert-note"
          rows={4}
          maxLength={MAX_NOTE}
          placeholder="Nhập nhận xét kỹ thuật, bằng chứng thêm hoặc hướng xử lý..."
          value={note}
          onChange={e => onNoteChange(e.target.value)}
          className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-[#27231F] placeholder-[#B8B4B0] focus:outline-none focus:ring-2 focus:ring-[#B5D32C] focus:border-transparent transition-all"
        />
        <div className="flex items-start justify-between mt-1.5 gap-2">
          <p className="text-[11px] text-[#878380] italic leading-relaxed flex-1">
            Lưu ý: Phán quyết của Chuyên gia sẽ xác thực độ tin cậy và hiệu chuẩn hệ thống, không tự động thay đổi trạng thái xử lý của cảnh báo.
          </p>
          <span className="text-xs text-[#878380] flex-shrink-0 font-mono">
            {note.length}/{MAX_NOTE} ký tự
          </span>
        </div>
      </div>
    </div>
  )
}
