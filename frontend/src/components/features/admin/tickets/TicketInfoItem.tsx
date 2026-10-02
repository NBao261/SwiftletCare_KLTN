import type { ReactNode } from 'react'
import type { Icon } from '@phosphor-icons/react'

/** 1 dòng trong card "Thông tin" của AdminTicketDetailPage — icon tròn + nhãn caption + giá trị */
export default function TicketInfoItem({ icon: ItemIcon, label, children }: { icon: Icon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warmGray/10 text-charcoal">
        <ItemIcon size={16} weight="bold" />
      </span>
      <div className="min-w-0">
        <dt className="label-caption">{label}</dt>
        <dd className="truncate text-body font-medium text-charcoal">{children}</dd>
      </div>
    </div>
  )
}
