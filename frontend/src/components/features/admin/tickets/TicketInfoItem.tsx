import type { ReactNode } from 'react'
import { tr, trChildren } from '@/i18n'

/** 1 dòng trong card "Thông tin" của AdminTicketDetailPage — nhãn caption + giá trị, không icon */
export default function TicketInfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-2.5">
      <dt className="label-caption">{tr(label)}</dt>
      <dd className="truncate text-body font-medium text-charcoal">{trChildren(children)}</dd>
    </div>
  )
}
