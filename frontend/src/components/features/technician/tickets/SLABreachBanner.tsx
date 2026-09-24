// SLABreachBanner.tsx — C3: Full-width red banner khi ticket vi phạm SLA
interface Props {
  /** Callback khi user bấm "Liên hệ Admin" — gọi escalate mutation ở parent */
  onEscalate?: () => void
  isEscalating?: boolean
}

export function SLABreachBanner({ onEscalate, isEscalating }: Props) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-alertRed px-5 py-4">
      <div>
        <p className="font-bold text-white">SLA ĐÃ BỊ VI PHẠM</p>
        <p className="text-sm text-white/80">Ticket đang được escalate lên Admin để xử lý</p>
      </div>
      {onEscalate && (
        <button
          onClick={onEscalate}
          disabled={isEscalating}
          className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-60"
        >
          {isEscalating ? 'Đang gửi…' : 'Liên hệ Admin ngay'}
        </button>
      )}
    </div>
  )
}
