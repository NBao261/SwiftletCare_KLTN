// SLABreachBanner.tsx — C3: Full-width red banner khi ticket vượt hạn xử lý SLA
// Escalate (báo Admin) là hành động thủ công của Technician — KHÔNG tự động khi vi phạm SLA.
interface Props {
  /** Callback khi user bấm "Báo Admin" — gọi escalate mutation ở parent */
  onEscalate?: () => void
  isEscalating?: boolean
  /** Ticket đã được báo Admin (escalated_at) → ẩn nút, hiện trạng thái */
  escalated?: boolean
}

export function SLABreachBanner({ onEscalate, isEscalating, escalated }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-alertRed px-5 py-4">
      <div>
        <p className="font-bold text-white">SLA ĐÃ BỊ VI PHẠM</p>
        <p className="text-sm text-white/80">
          {escalated ? 'Ticket đã được báo cho Admin để hỗ trợ xử lý.' : 'Ticket đã quá hạn xử lý. Nếu cần hỗ trợ, hãy báo Admin.'}
        </p>
      </div>
      {onEscalate && !escalated && (
        <button
          onClick={onEscalate}
          disabled={isEscalating}
          className="shrink-0 rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-60"
        >
          {isEscalating ? 'Đang gửi…' : 'Báo Admin'}
        </button>
      )}
    </div>
  )
}
