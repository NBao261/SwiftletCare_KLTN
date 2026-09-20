// SLABreachBanner.tsx — C3: Full-width red banner khi ticket vi phạm SLA
import { Button } from '@/components/ui'

export function SLABreachBanner() {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-alertRed px-5 py-4">
      <div>
        <p className="font-bold text-white">SLA ĐÃ BỊ VI PHẠM</p>
        <p className="text-sm text-white/80">Ticket đang được escalate lên Admin để xử lý</p>
      </div>
      <Button variant="icon" size="sm" className="border border-white/30 text-white hover:bg-white/10">
        Liên hệ Admin ngay
      </Button>
    </div>
  )
}
